import React, { useContext, useEffect, useState, useCallback } from 'react'

import { useNavigate, useMatch } from 'react-router-dom'
import { Box, ListSubheader, Typography } from '@mui/material'
import Avatar from '@mui/material/Avatar'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import makeStyles from '@mui/styles/makeStyles'

import { AppContext } from '../stores/AppContext'
import AvatarLogged from './AvatarLogged'

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    overflowY: 'auto',
    height: '100%'
  },
  headerList: {
    zIndex: 2, // Above badge login
    backgroundColor: theme.palette.primary.dark,
    color: theme.palette.primary.contrastText
  },
  you: {
    marginLeft: theme.spacing(1)
  }
}))

function ListOnlines () {
  const [{ users, currentUser, rooms }, dispatch] = useContext(AppContext)
  const classes = useStyles()
  const match = useMatch('/rooms/:currentRoomId')
  const currentRoomId = match?.params?.currentRoomId
  const navigate = useNavigate()

  const redirectToRoom = useCallback(
    async key => {
      try {
        const userId1 = key
        const userId2 = currentUser.id
        let room = rooms.find(room => room.one2one && room.users.includes(userId1) && room.users.includes(userId2))

        navigate({
          pathname: `/rooms/${room.id}`
        })
      } catch (error) {
        console.error(error)
      }
    },
    [currentUser.id, dispatch, currentRoomId, rooms, navigate]
  )

  return (
    <List
      className={classes.root}
      subheader={
        <ListSubheader className={classes.headerList} component='div' id='nested-list-subheader'>
          Users ({users.length})
        </ListSubheader>
      }
    >
      {users.map(user => {
          const labelId = `checkbox-list-secondary-label-${user.id}`
          return (
            <ListItem
              key={user.id}
              button={currentUser.id !== user.id}
              onClick={() => (currentUser.id !== user.id ? redirectToRoom(user.id) : null)}
            >
              <ListItemAvatar>
                {/* eslint-disable-next-line no-constant-condition */}
                {user.isOnline || true
                  ? (
                    <AvatarLogged
                      overlap='circular'
                      anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right'
                      }}
                      variant='dot'
                    >
                      <Avatar alt={user.name} src={user.photoURL} />
                    </AvatarLogged>
                    )
                  : (
                    <Avatar alt={user.name} src={user.photoURL} />
                    )}
              </ListItemAvatar>
              <ListItemText
                id={labelId}
                primary={
                  <Box display='flex' alignItems='center'>
                    <Typography>{user.name}</Typography>
                    {currentUser.id === user.id
                      ? (
                        <Typography className={classes.you} variant='caption'>
                          (you)
                        </Typography>
                        )
                      : null}
                  </Box>
                }
              />
            </ListItem>
          )
        })}
    </List>
  )
}

export default ListOnlines
