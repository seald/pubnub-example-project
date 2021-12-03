import React, { useContext, useEffect, useState } from 'react'
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles'
import { Navigate, HashRouter as Router, Routes, Route } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { SnackbarProvider } from 'notistack'

import ErrorBoundary from './components/ErrorBoundary'
import Rooms from './containers/Rooms'
import SignIn from './containers/SignIn'
import SignUp from './containers/SignUp'
import { AppContext } from './stores/AppContext'
import theme from './theme'
import { Room, User } from './utils/models'
import {ADD_USER, EDIT_OR_ADD_ROOM, REMOVE_ROOM, SET_AUTH, SET_ROOMS, SET_USERS} from './stores/reducer/constants'
import {PubNubProvider} from 'pubnub-react'
import settings from './settings.json'
import PubNub from 'pubnub'
import { getSealdSDKInstance } from './services/seald'


function PubNubChat ({ ...props }) {
  const [{ currentUser, users }, dispatch] = useContext(AppContext)

  let isInitialize = false
  const pubnub = new PubNub({
    publishKey: settings.PUBNUB_PUB_KEY,
    subscribeKey: settings.PUBNUB_SUB_KEY,
    uuid: currentUser.id,
    email: currentUser.emailAddress
  })

  useEffect(() => {
    const init = async () => {
      isInitialize = true

      await pubnub.objects.setUUIDMetadata({
        uuid: currentUser.id,
        data: {
          email: currentUser.emailAddress,
          name: currentUser.name
        }
      })

      pubnub.addListener({
        objects: async function(objectEvent) {
          if (objectEvent.message.type === 'membership') {
            if (objectEvent.message.event === 'delete') { // User is removed from a room
              dispatch({
                type: REMOVE_ROOM,
                payload: {
                  roomId: objectEvent.message.data.channel.id
                }
              })
            }
            if (objectEvent.message.event === 'set') { // User is added to a room
              const metadata = await pubnub.objects.getChannelMetadata({ channel: objectEvent.message.data.channel.id })
              const roomMembers = (await pubnub.objects.getChannelMembers({ channel: objectEvent.message.data.channel.id })).data.map(u => u.uuid.id)

              if (metadata.data.custom.one2one) {
                const otherUser = roomMembers.filter(uid => uid !== currentUser.id)[0]

                // If it's a room with a new user, we have to add him in our local DB
                if (!users.find(u => u.id === otherUser)) {
                  const newUserInfo = await pubnub.objects.getUUIDMetadata({ uuid: otherUser })
                  dispatch({
                    type: ADD_USER,
                    payload: {
                      user: new User({ id: newUserInfo.data.id, emailAddress: newUserInfo.data.email, name: newUserInfo.data.name })
                    }
                  })
                }
              }
              dispatch({
                type: EDIT_OR_ADD_ROOM,
                payload: {
                  room: new Room({
                      id: metadata.data.id,
                      name: metadata.data.name,
                      ownerId: metadata.data.custom.ownerId,
                      users: roomMembers,
                      one2one: metadata.data.custom.one2one
                    }
                  )
                }
              })
              pubnub.subscribe({ channels: [metadata.data.id] }) // Subscribe to the newly created room
            }
          }
        }
      })
      pubnub.subscribe({ channels: [currentUser.id] }) // channel on which events concerning the current user are published

      // Retrieve existing users
      const existingMembers = await pubnub.objects.getAllUUIDMetadata()
      dispatch({
        type: SET_USERS,
        payload: {
          users: existingMembers.data.map(u => new User({ id: u.id, name: u.name, emailAddress: u.email }))
        }
      })

      // Retrieve rooms of which we are members
      const memberships = await pubnub.objects.getMemberships({
        include: {
          customChannelFields: true
        }
      })
      const knownRooms = []
      // For each room, retrieve room members
      for (const room of memberships.data.filter(r => !r.channel.custom.archived)) {
        const roomMembers = await pubnub.objects.getChannelMembers({ channel: room.channel.id })
        knownRooms.push(new Room({
          id: room.channel.id,
          name: room.channel.name,
          users: roomMembers.data.map(u => u.uuid.id),
          ownerId: room.channel.custom.ownerId,
          one2one: room.channel.custom.one2one
        }))
      }
      // Store rooms in our data store
      dispatch({
        type: SET_ROOMS,
        payload: {
          rooms: knownRooms
        }
      })
      // Subscribe to channels to get new messages
      pubnub.subscribe({ channels: knownRooms.map(r => r.id) })

      // Ensure that we have a one2one room with everyone
      const one2oneRooms = knownRooms.filter(r => r.one2one)
      for (const m of existingMembers.data.filter(u => u.id!== currentUser.id)) {
        if (!one2oneRooms.find(r => r.users.includes(m.id))) {
          // New user found: generating a new one2one room
          const newRoomId = PubNub.generateUUID()
          // Add the new room to our local list
          dispatch({
            type: EDIT_OR_ADD_ROOM,
            payload: {
              room: new Room({
                id: newRoomId,
                users: [currentUser.id, m.id],
                one2one: true,
                name: m.name, ownerId: currentUser.id
              })
            }
          })
          // Create a Seald session
          const sealdSession = await getSealdSDKInstance().createEncryptionSession(
            { userIds: [currentUser.id, m.id] },
            { metadata: newRoomId }
          )
          // Publish a "Hello" message in the room
          await pubnub.publish({
            channel: newRoomId,
            message: {
              type: 'message',
              data: (await sealdSession.encryptMessage('Hello 👋'))
            }
          })
          // Subscribe to the new room
          pubnub.subscribe({ channels: [newRoomId] })
          await pubnub.objects.setChannelMetadata({
            channel: newRoomId,
            data: {
              name: 'one2one',
              custom: {
                one2one: true,
                ownerId: currentUser.id,
              },
            }
          })
          await pubnub.objects.setChannelMembers({
            channel: newRoomId,
            uuids: [currentUser.id, m.id]
          })
        }
      }
    }

    if (!isInitialize) init()
  }, [dispatch])

  return (
    <PubNubProvider client={pubnub}>
      <Rooms {...props} />
    </PubNubProvider>
  )
}

function App () {
  const [isLoading, setIsLoading] = useState(true)
  const [state, dispatch] = useContext(AppContext)

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = User.getCurrentUser() // || await User.updateCurrentUser() // TODO : Seald-SDK loads in memory, cannot retrieve it from session, must type password
        dispatch({ type: SET_AUTH, payload: { currentUser } })
        setIsLoading(false)
      } catch (error) {
        console.error(error)
        setIsLoading(false)
      }
    }

    init()
  }, [dispatch])

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <ErrorBoundary>
          <CssBaseline />
          {isLoading
            ? (
              <Box height='100vh' width='100vw' display='flex' justifyContent='center' alignItems='center'>
                <CircularProgress />
              </Box>
              )
            : (
              <Router>
                <Routes>
                  <Route path='/sign-up' exact element={!!state.currentUser === false ? <SignUp /> : <Navigate to='/rooms' />} />
                  <Route path='/sign-in' exact element={!!state.currentUser === false ? <SignIn /> : <Navigate to='/rooms' />} />
                  <Route path='/rooms/' exact element={!!state.currentUser === true ? <PubNubChat /> : <Navigate to='/sign-in' />} />
                  // <Route path='/rooms/:roomId' exact element={!!state.currentUser === true ? <PubNubChat /> : <Navigate to='/sign-in' />} />
                  <Route path='/' exact element={<Navigate to='/rooms' />} />
                </Routes>
              </Router>
              )}
        </ErrorBoundary>
      </SnackbarProvider>
    </ThemeProvider>
    </StyledEngineProvider>
  )
}

export default App
