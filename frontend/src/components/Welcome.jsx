import React, { useContext } from 'react'
import { Box, Link, Typography } from '@mui/material'

import makeStyles from '@mui/styles/makeStyles'


import { START_ADD_DIALOG_ROOM } from '../stores/reducer/constants'
import { AppContext } from '../stores/AppContext'

const useStyles = makeStyles(() => ({
  root: {
    height: '70vh'
  }
}))

function Welcome () {
  const [, dispatch] = useContext(AppContext)
  const classes = useStyles()

  return (
    <Box
      display='flex'
      className={classes.root}
      flexDirection='column'
      alignItems='center'
      justifyContent='center'
      bgcolor='background.paper'
    >
      <Typography color='textPrimary' variant='body1' align='center'>
        Select a user or a room to discuss <br /> or{' '}
        <Link href='#' underline='always' onClick={() => dispatch({ type: START_ADD_DIALOG_ROOM })}>
          create a room
        </Link>
      </Typography>
    </Box>
  )
}

export default Welcome
