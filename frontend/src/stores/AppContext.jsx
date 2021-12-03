import React, { useReducer } from 'react'

import reducer from './reducer/reducer'

export const AppContext = React.createContext()

const initialState = {
  currentUser: null,
  users: [],
  rooms: [],
  dialogRoom: {
    room: undefined,
    isOpen: false,
    selectedUsersId: [],
    name: '',
    isLoading: false,
    oldUidUsers: []
  }
}

function AppProvider ({ children }) {
  const [state, updater] = useReducer(reducer, initialState)
  return <AppContext.Provider value={[state, updater]}>{children}</AppContext.Provider>
}

export default AppProvider
