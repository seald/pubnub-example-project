import React, { memo, useContext, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Avatar,
  Box,
  FormControl,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography
} from '@mui/material'
import makeStyles from '@mui/styles/makeStyles'
import EditIcon from '@mui/icons-material/Edit'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import SendIcon from '@mui/icons-material/Send'
import Skeleton from '@mui/material/Skeleton'
import { useSnackbar } from 'notistack'
import { useImmer } from 'use-immer'

import { START_EDIT_DIALOG_ROOM } from '../stores/reducer/constants'
import { AppContext } from '../stores/AppContext'
import GroupAvatar from './GroupAvatar'
import Message from './Message'
import UploadButton from './UploadButton'
import { getSealdSDKInstance } from '../services/seald'
import { usePubNub } from 'pubnub-react'

const useStyles = makeStyles(theme => ({
  root: {
    height: '70vh'
  },
  formControl: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row'
  },
  input: {
    flexGrow: 1
  },
  sendButton: {
    color: theme.palette.grey[500],
    marginLeft: 5
  },
  smallAvatar: {
    width: theme.spacing(3),
    height: theme.spacing(3),
    marginRight: theme.spacing(1)
  },
  messageWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    marginBottom: theme.spacing(1)
  },
  messageLine: {
    '&:last-child > div': {
      marginBottom: 0
    },
    '&:first-child': {
      marginTop: 'auto'
    }
  }
}))

function Chat ({ roomId: currentRoomId }) {
  const classes = useStyles()
  const sealdSessionRef = useRef(null)
  const pubnub = usePubNub()
  const { enqueueSnackbar } = useSnackbar()
  const [{ currentUser, users, rooms }, dispatch] = useContext(AppContext)
  const [state, setState] = useImmer({
    room: null,
    messages: [],
    message: '',
    users: [],
    isCustomRoom: false,
    isRoomInvalid: false,
    isLoading: true
  })

  const decryptMessage = async m => {
    try {
      let encryptedData
      // If message is a --FILE--, encryptedMessage does not contains an encrypted message
      if (m.message.type === 'file') encryptedData = m.message.fileName
      else if (m.message.type === 'message') encryptedData = m.message.data
      else {
        console.error('type is invalid')
        return {
          ...m,
          value: 'TYPE IS INVALID'
        }
      }

      if (!sealdSessionRef.current) { // no encryption session set in cache yet
        // we try to get it by parsing the current message
        sealdSessionRef.current = await getSealdSDKInstance().retrieveEncryptionSession({ encryptedMessage: encryptedData })
        // now that we have a session loaded, let's decrypt
      }
      const decryptedData = await sealdSessionRef.current.decryptMessage(encryptedData)

      // we have successfully decrypted the message
      return {
        ...m,
        uuid: m.uuid || m.publisher,
        value: decryptedData
      }
    } catch (error) {
      // an error happened, it means that:
      // 1. the encryptedMessage is corrupted;
      // 2. the SDK does not have the rights to decrypt;
      // 3. a random network error happened
      console.error('failed decryption of', m.message, ' with error:', error, 'skipping decryption')
      return {
        ...m,
        value: 'CLEAR ' + m.message.data || m.message.fileName
      }
    }
  }

  useEffect(() => {
    const init = async () => {
      const currentRoom = rooms.find(r => r.id === currentRoomId)
      if (currentRoom) {
        try {
          if (!(currentRoom.users.includes(currentUser.id))) {
            enqueueSnackbar('Access denied', { variant: 'error' })
            setState(draft => {
              draft.isRoomInvalid = true
            })
          } else {
            setState(draft => {
              draft.message = ''
              draft.isCustomRoom = !currentRoom.one2one
              draft.room = currentRoom
              draft.roomTitle = currentRoom.one2one ? users.find(user => user.id === currentRoom.users.find(id => id !== currentUser.id)).name : currentRoom.name
              draft.canCustomizeRoom = !currentRoom.one2one && currentRoom.ownerId === currentUser.id
              draft.users = users.filter(u => currentRoom.users.includes(u.id))
              draft.messages = []
            })
            sealdSessionRef.current = null

            const fetchedMessages = (await pubnub.fetchMessages({ channels: [currentRoomId] })).channels[currentRoomId]
            const clearMessages = fetchedMessages ? await Promise.all(fetchedMessages.map(decryptMessage)) : []
            console.log('clearMessages', clearMessages)

            setState(draft => {
              draft.messages = [...clearMessages]
              draft.isLoading = false
            })
          }
        } catch (error) {
          console.error(error)
          enqueueSnackbar(error.toString(), { variant: 'error' })
          setState(draft => {
            draft.isRoomInvalid = true
          })
        }
      } else if (state.room) { // room is already set, but does not exist anymore, must have been deleted re-render arrived here
        setState(draft => {
          draft.isRoomInvalid = true
        })
      } else {
        enqueueSnackbar('This room does not exist', { variant: 'error' })
        setState(draft => {
          draft.isRoomInvalid = true
        })
      }
    }

    if (currentRoomId && currentUser && !state.isRoomInvalid) {
      console.log('init room')
      init()
    } else {
      console.log('no room')
      setState(draft => {
        draft.room = null
        draft.messages = []
        draft.message = ''
      })
    }
  }, [currentRoomId, setState, currentUser, enqueueSnackbar, rooms])

  const handleEditRoom = () => {
    dispatch({
      type: START_EDIT_DIALOG_ROOM,
      payload: {
        room: state.room,
        name: state.room.name,
        selectedUsersId: state.room.users,
        sealdSession: sealdSessionRef.current
      }
    })
  }

  const handleSubmitMessage = async e => {
    e.preventDefault()
    if (!state.room) {
      enqueueSnackbar('Please select a room or create a new one', { variant: 'error' })
    } else if (state.message.trim()) {
      try {
        // if there is no encryption session set in cache yet, create one
        // (should never happen, as a "Hello" is sent on room creation)
        if (!sealdSessionRef.current) {
          sealdSessionRef.current = await getSealdSDKInstance().createEncryptionSession(
            { userIds: state.room.users },
            { metadata: state.room.id }
          )
        }
        // use the session to encrypt the message we are trying to send
        const encryptedMessage = await sealdSessionRef.current.encryptMessage(state.message)
        // publish the encrypted message to pubnub
        await pubnub.publish({
          channel: state.room.id,
          message: {
              type: 'message',
              data: encryptedMessage
            }
        })

        setState(draft => {
          draft.message = ''
        })
      } catch (error) {
        console.error(error)
        enqueueSnackbar(error.message, { variant: 'error' })
      }
    }
  }
  const handleReceiveMessage = async m => {
    const decryptedMessage = await decryptMessage(m)
    setState(draft => {
      draft.messages = [...draft.messages, decryptedMessage]
    })
  }

  useEffect(() => {
    pubnub.addListener({ message: handleReceiveMessage })
    pubnub.subscribe({ channels: [currentRoomId] })
  }, [])

  if (state.isRoomInvalid) return <Navigate to="/rooms"/>

  return (
    <Box
      display="flex"
      className={classes.root}
      flexDirection="column"
      bgcolor="background.paper">
      <Paper elevation={1}>
        <Box
          p={2}
          flexShrink={0}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          bgcolor="grey.200"
          color="primary.main"
          height="80px"
        >
          <Box
            display="flex"
            flexGrow={1}
            alignItems="center">
            {state.isLoading && (
              <Skeleton width="30%">
                <Typography>.</Typography>
              </Skeleton>
            )}
            {!state.isLoading && (
              <>
                <Typography
                  variant="h6"
                  component="h1">
                  {state.roomTitle}
                </Typography>
                {state.canCustomizeRoom && (
                  <IconButton
                    style={{
                      marginLeft: 5
                    }}
                    edge="start"
                    size="small"
                    color="secondary"
                    aria-label="edit room"
                    component="span"
                    onClick={handleEditRoom}
                  >
                    <EditIcon/>
                  </IconButton>
                )}
              </>
            )}
          </Box>

          <Box
            display="flex"
            alignItems="center">
            {state.isLoading && (
              <>
                <Skeleton variant="circular">
                  <Avatar/>
                </Skeleton>
                <Skeleton variant="circular">
                  <Avatar/>
                </Skeleton>
              </>
            )}
            {!state.isLoading && (
              <>
                <GroupAvatar users={state.users}/>
                {state.canCustomizeRoom && (
                  <IconButton
                    style={{
                      marginLeft: 5
                    }}
                    edge="start"
                    size="small"
                    color="secondary"
                    aria-label="edit room"
                    component="span"
                    onClick={handleEditRoom}
                  >
                    <GroupAddIcon/>
                  </IconButton>
                )}
              </>
            )}
          </Box>
        </Box>
      </Paper>
      <Box
        p={1}
        style={{ overflowY: 'scroll' }}
        display="flex"
        flexDirection="column"
        flexGrow={1}>
        {state.messages.map(m => {
          const senderId = m.uuid
          const isCurrentUser = senderId === currentUser.id
          const sender = users.find(u => u.id === senderId)
          return (
            <Box
              width="100%"
              display="flex"
              justifyContent={isCurrentUser ? 'flex-end' : 'flex-start'}
              key={m.timetoken}
              className={classes.messageLine}
            >
              <Box className={classes.messageWrapper}>
                {!isCurrentUser && (
                  <Tooltip title={sender.name}>
                    <Avatar
                      className={classes.smallAvatar}
                      sizes="small"
                      src={sender.photoURL}/>
                  </Tooltip>
                )}
                <Message
                  isCurrentUser={isCurrentUser}
                  value={m.value}
                  data={m.message}
                  sealdSession={sealdSessionRef.current}/>
              </Box>
            </Box>
          )
        })}
      </Box>
      <Box
        p={2}
        style={{ paddingBottom: 4, paddingTop: 4 }}
        flexShrink={0}
        bgcolor="grey.100">
        <form
          noValidate
          onSubmit={handleSubmitMessage}>
          <FormControl
            disabled={state.isLoading}
            className={classes.formControl}
            variant="filled">
            <UploadButton
              room={state.room}
              sealdSession={sealdSessionRef.current}/>
            <InputBase
              value={state.message}
              onChange={e => {
                const value = e.target.value
                setState(draft => {
                  draft.message = value
                })
              }}
              className={classes.input}
              placeholder="Type a message"
              inputProps={{ 'aria-label': 'type message' }}
            />

            <IconButton
              className={classes.sendButton}
              edge="start"
              disabled={state.isLoading}
              size="medium"
              color="primary"
              aria-label="send message"
              component="button"
              type="submit"
            >
              <SendIcon/>
            </IconButton>
          </FormControl>
        </form>
      </Box>
    </Box>
  )
}

export default memo(Chat)
