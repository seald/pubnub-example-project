import React, { useCallback, useState, useContext } from 'react'

import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Box,
  Checkbox,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Typography
} from '@mui/material'
import makeStyles from '@mui/styles/makeStyles'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useSnackbar } from 'notistack'

import { Room } from '../utils/models'
import {
  CLOSE_DIALOG_ROOM, EDIT_OR_ADD_ROOM,
  FAILED_DIALOG_ROOM,
  SET_ROOM_NAME,
  SUCCESS_DIALOG_ROOM,
  TOGGLE_LOADING_ROOM,
  TOGGLE_SELECTED_USERS_ROOM
} from '../stores/reducer/constants'
import { AppContext } from '../stores/AppContext'
import { getSealdSDKInstance } from '../services/seald'
import { usePubNub } from 'pubnub-react'
import PubNub from "pubnub";

const useStyles = makeStyles(theme => {
  return {
    listUsers: {
      width: '100%',
      maxHeight: 200,
      overflowY: 'auto',
      padding: theme.spacing(1, 0),
      margin: theme.spacing(1, 0),
      backgroundColor: theme.palette.background.paper
    },
    you: {
      marginLeft: theme.spacing(1)
    }
  }
})

function ManageDialogRoom () {
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const [{ users, currentUser, dialogRoom }, dispatch] = useContext(AppContext)
  const classes = useStyles()
  const [isErrorRoomName, setIsErrorRoomName] = useState(false)
  const pubnub = usePubNub()

  const handleToggle = useCallback(
    id => () => {
      dispatch({
        type: TOGGLE_SELECTED_USERS_ROOM,
        payload: { id }
      })
    },
    [dispatch]
  )

  const handleClose = useCallback(() => {
    dispatch({ type: CLOSE_DIALOG_ROOM })
    setIsErrorRoomName(false)
  }, [dispatch])

  const handleSubmit = async e => {
    e.preventDefault()
    if (dialogRoom.name.trim() === '') {
      setIsErrorRoomName(true)
      return
    }
    try {
      dispatch({ type: TOGGLE_LOADING_ROOM })
      if (dialogRoom.room) {
        // we compare old and new members to figure out which ones were just added or removed
        const usersToRemove = dialogRoom.room.users.filter(id => !dialogRoom.selectedUsersId.includes(id))
        const usersToAdd = dialogRoom.selectedUsersId.filter(id => !dialogRoom.room.users.includes(id))

        if (usersToAdd.length > 0) {
          // for every added user, add them to the Seald session
          await dialogRoom.sealdSession.addRecipients({ userIds: usersToAdd })
          // then add them to the pubnub channel
          await pubnub.objects.setChannelMembers({
            channel: dialogRoom.room.id,
            uuids: usersToAdd
          })
        }

        if (usersToRemove.length > 0) {
          // for every removed user, revoke them from the Seald session
          await dialogRoom.sealdSession.revokeRecipients({ userIds: usersToRemove })
          // then remove them from the pubnub channel
          for (const u of usersToRemove) {
            await pubnub.objects.removeMemberships({
              channels: [dialogRoom.room.id],
              uuid: u
            })
          }
        }

        await pubnub.objects.setChannelMetadata({
          channel: dialogRoom.room.id,
          data: {
            name: dialogRoom.name,
            custom: {
              one2one: false,
              ownerId: dialogRoom.room.id
            },
          }
        })
        await dialogRoom.room.edit({ name: dialogRoom.name, users: dialogRoom.selectedUsersId })
      } else {
        const newRoomId = PubNub.generateUUID()
        dispatch({
          type: EDIT_OR_ADD_ROOM,
          payload: {
            room: new Room({
                id: newRoomId,
                name: dialogRoom.name,
                ownerId:currentUser.id,
                users: [currentUser.id, ...dialogRoom.selectedUsersId],
                one2one: false
              }
            )
          }
        })
        const sealdSession = await getSealdSDKInstance().createEncryptionSession(
          { userIds: dialogRoom.selectedUsersId },
          { metadata: newRoomId }
        )
        await pubnub.publish({
          channel: newRoomId,
          message: {
            type: 'message',
            data: (await sealdSession.encryptMessage('Hello 👋'))
          }
        })
        pubnub.subscribe({ channels: [newRoomId] })
        await pubnub.objects.setChannelMetadata({
          channel: newRoomId,
          data: {
            name: dialogRoom.name,
            custom: {
              one2one: false,
              ownerId: currentUser.id
            },
          }
        })
        await pubnub.objects.setChannelMembers({
          channel: newRoomId,
          uuids: [currentUser.id, ...dialogRoom.selectedUsersId]
        })
        navigate(`/rooms/${newRoomId}`)
      }

      dispatch({ type: SUCCESS_DIALOG_ROOM })
    } catch (error) {
      enqueueSnackbar(error.message, { variant: 'error' })
      dispatch({ type: FAILED_DIALOG_ROOM })
      console.error(error)
    }
  }

  const { name, selectedUsersId, isLoading, isOpen } = dialogRoom

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="form-dialog-title">
      <DialogTitle id="form-dialog-title">{dialogRoom.room ? 'Edit room' : 'Add room'}</DialogTitle>
      <DialogContent>
        <DialogContentText>Name your room and select the users you want to chat with</DialogContentText>
        <TextField
          autoFocus
          error={isErrorRoomName}
          value={name}
          helperText={isErrorRoomName ? 'Incorrect entry' : ''}
          onChange={e => {
            const value = e.target.value
            setIsErrorRoomName(false)
            dispatch({
              type: SET_ROOM_NAME,
              payload: { name: value }
            })
          }}
          margin="dense"
          id="name"
          spellCheck="false"
          label="Room name"
          type="text"
          fullWidth
        />
        <List
          dense
          className={classes.listUsers}>
          {Array.from(users)
            .sort(user => user.id === currentUser.id ? -1 : 0)
            .map(user => {
              const labelId = `checkbox-list-secondary-label-${user.id}`
              return (
                <ListItem
                  key={user.id}
                  button
                  component="label"
                  htmlFor={user.id}>
                  <ListItemAvatar>
                    <Avatar alt={user.name} />
                  </ListItemAvatar>
                  <ListItemText
                    id={labelId}
                    primary={
                      <Box
                        display="flex"
                        alignItems="center">
                        <Typography>{user.name}</Typography>
                        {currentUser.id === user.id && (
                          <Typography
                            className={classes.you}
                            variant="caption">
                            (you)
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Checkbox
                      edge="end"
                      id={user.id}
                      disabled={currentUser.id === user.id}
                      checked={currentUser.id === user.id || selectedUsersId.indexOf(user.id) !== -1}
                      onChange={handleToggle(user.id)}
                      inputProps={{ 'aria-labelledby': labelId }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              )
            })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          color="primary">
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ManageDialogRoom
