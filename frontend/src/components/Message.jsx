/* eslint-env browser */

import React, { memo, useEffect } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import makeStyles from '@mui/styles/makeStyles'
import { useImmer } from 'use-immer'
import DLIcon from '@mui/icons-material/Description'

const useStyles = makeStyles(theme => ({
  root: {
    backgroundColor: props => {
      if (props.isError) {
        return theme.palette.error.main
      } else if (props.isLoading) {
        return theme.palette.grey[300]
      } else if (props.isCurrentUser) {
        return theme.palette.primary.main
      } else {
        return theme.palette.grey[600]
      }
    },
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(1.1),
    borderRadius: '1.3em',
    borderBottomRightRadius: props => (props.isCurrentUser ? 0 : '1.3em'),
    borderBottomLeftRadius: props => (props.isCurrentUser ? '1.3em' : 0),
    maxWidth: 250,
    transition: 'background-color 0.3s',
    minWidth: 10,
    wordBreak: 'break-word'
  }
}))

function Message ({ value, isCurrentUser, data, sealdSession }) {
  const [state, setState] = useImmer({
    isLoading: typeof value !== 'string',
    isError: false,
    val: typeof value !== 'string' ? undefined : value,
    data: typeof data === 'object' ? data : undefined
  })
  const classes = useStyles({ isCurrentUser, isError: state.isError, isLoading: state.isLoading })

  useEffect(() => {
    let hasCancelled = false
    ;(async () => {
      try {
        const val = await value
        if (!hasCancelled) {
          setState(draft => {
            draft.val = val
            draft.isLoading = false
          })
        }
      } catch (error) {
        console.error(error)
        setState(draft => {
          draft.isLoading = false
          draft.isError = true
        })
      }
    })()

    return () => {
      hasCancelled = true
    }
  }, [value, setState])

  const onClick = async () => {
    if (state.data.type === 'file') {
      const response = await fetch(state.data.url)
      const encryptedBlob = await response.blob()
      const { data: clearBlob, filename } = await sealdSession.decryptFile(encryptedBlob)
      const href = window.URL.createObjectURL(clearBlob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    }
  }

  return (
    <Box className={classes.root}>
      {state.isLoading
        ? (
          <CircularProgress
            color='secondary'
            size={18}
            style={{
              color: 'white'
            }}
          />
          )
        : (
          <Typography color='inherit' variant='body2' onClick={onClick}>
            {
              state.isError
                ? 'An error occured'
                : (
                    state.data.type === 'file'
                      ? <><DLIcon fontSize='large' /><br />{state.val}</>
                      : state.val
                  )
            }
          </Typography>
          )}
    </Box>
  )
}

export default memo(Message)
