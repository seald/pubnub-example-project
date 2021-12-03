import React, { useContext } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { Box, Container, Fab, Grid, Paper, Tooltip } from '@mui/material'
import makeStyles from '@mui/styles/makeStyles'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import HomeIcon from '@mui/icons-material/Home'
import { useSnackbar } from 'notistack'

import Chat from '../components/Chat'
import ListCustomRooms from '../components/ListCustomRooms'
import ListOnlines from '../components/ListOnline'
import AddRoomDialog from '../components/ManageDialogRoom'
import Welcome from '../components/Welcome'
import { User } from '../utils/models'
import {
  SET_AUTH,
  START_ADD_DIALOG_ROOM
} from '../stores/reducer/constants'
import { AppContext } from '../stores/AppContext'

const useStyles = makeStyles(theme => {
  return {
    root: {
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    paper: {
      width: '100%'
    },
    screenContainer: {
      height: '70vh',
      overflow: 'hidden',
      backgroundColor: theme.palette.primary.dark,
      color: theme.palette.primary.contrastText
    },
    signOutIcon: {
      position: 'absolute',
      bottom: theme.spacing(2),
      right: theme.spacing(2)
    },
    addIcon: {
      position: 'absolute',
      bottom: theme.spacing(10),
      right: theme.spacing(2)
    },
    homeIcon: {
      position: 'absolute',
      bottom: theme.spacing(18),
      right: theme.spacing(2)
    }
  }
})

function Rooms () {
  const navigate = useNavigate()
  const [, dispatch] = useContext(AppContext)
  const match = useMatch('/rooms/:currentRoomId')
  const currentRoomId = match?.params?.currentRoomId
  const { enqueueSnackbar } = useSnackbar()
  const classes = useStyles()

  const handleLogout = async () => {
    try {
      await User.logout()
      dispatch({ type: SET_AUTH, payload: { currentUser: null } })
      navigate('/sign-in', { replace: true })
    } catch (error) {
      console.error(error)
      enqueueSnackbar(error.message, {
        variant: 'error'
      })
    }
  }

  return (
    <>
      <Container className={classes.root} component='main' maxWidth='md'>
        <Paper elevation={3} className={classes.paper}>
          <Grid container className={classes.screenContainer}>
            <Grid item xs={5}>
              <Box height='70vh'>
                <Box height='50%' flexGrow={1} style={{ overflow: 'hidden' }}>
                  <ListOnlines />
                </Box>
                <Box height='50%' flexGrow={1} style={{ overflow: 'hidden' }}>
                  <ListCustomRooms />
                </Box>
              </Box>
            </Grid>
            <Grid item xs={7}>
              {currentRoomId ? <Chat roomId={currentRoomId} /> : <Welcome />}
            </Grid>
          </Grid>
        </Paper>
        <Tooltip title='Sign out' placement='top'>
          <Fab aria-label='home' className={classes.homeIcon} color='primary' onClick={() => navigate('/rooms')}>
            <ExitToAppIcon />
          </Fab>
        </Tooltip>
        <Tooltip title='Add a room' placement='top'>
          <Fab
            aria-label='add room'
            className={classes.addIcon}
            color='primary'
            onClick={() =>
              dispatch({
                type: START_ADD_DIALOG_ROOM
              })}
          >
            <AddCircleIcon />
          </Fab>
        </Tooltip>
        <Tooltip title='Back to Home' placement='top'>
          <Fab aria-label='home' className={classes.homeIcon} color='primary' onClick={() => history.push('/rooms')}>
            <HomeIcon />
          </Fab>
        </Tooltip>
      </Container>
      <AddRoomDialog />
    </>
  )
}

export default Rooms
