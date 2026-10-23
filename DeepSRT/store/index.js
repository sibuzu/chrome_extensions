import { Store } from 'webext-redux/dist/webext-redux.js';

// Create store instance
const store = new Store();

// Initial state
const initialState = {
  playerData: null,
  videoId: null,
  title: null,
  timestamp: null,
  captions: null,
  transcript: null,
  error: null,
  connections: {
    content: false,
    sidebar: false,
  },
  lastAction: null,
};

// Action types
export const UPDATE_PLAYER_DATA = 'UPDATE_PLAYER_DATA';
export const SET_CONNECTION = 'SET_CONNECTION';
export const SET_VIDEO_ID = 'SET_VIDEO_ID';
export const SET_TRANSCRIPT = 'SET_TRANSCRIPT';
export const SET_ERROR = 'SET_ERROR';

// Reducer
export const rootReducer = (action, state = initialState) => {
  console.log('[Store] Reducer processing:', {
    type: action.type,
    hasPayload: !!action.payload,
    videoId: action.payload?.videoId,
    hasCaptions: !!action.payload?.captions,
  });

  // Store the action type
  const newState = {
    ...state,
    connections: state.connections || {},
    lastAction: action.type,
  };

  switch (action.type) {
  case UPDATE_PLAYER_DATA: {
    const updatedState = {
      ...newState,
      playerData: action.payload.playerData,
      videoId: action.payload.videoId,
      title: action.payload.title,
      timestamp: action.payload.timestamp,
      captions: action.payload.captions,
      hasCaptions: action.payload.hasCaptions,
    };

    console.log('[Store] State updated:', {
      videoId: updatedState.videoId,
      title: updatedState.title,
      hasCaptions: updatedState.hasCaptions,
      captionTracks: updatedState.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0,
      timestamp: updatedState.timestamp,
    });

    return updatedState;
  }

  case SET_CONNECTION: {
    return {
      ...newState,
      connections: {
        ...newState.connections,
        [action.payload.component]: action.payload.isConnected,
      },
    };
  }

  case SET_VIDEO_ID: {
    return {
      ...newState,
      videoId: action.payload,
    };
  }

  case SET_TRANSCRIPT: {
    return {
      ...newState,
      transcript: action.payload,
    };
  }

  case SET_ERROR: {
    return {
      ...newState,
      error: action.payload,
    };
  }

  default:
    return newState;
  }
};

// Action creators
export const updatePlayerData = (data) => {
  console.log('[Store] Creating updatePlayerData action:', {
    videoId: data.videoId,
    title: data.title,
    hasCaptions: data.hasCaptions,
    captionCount: data.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0,
    timestamp: data.timestamp,
  });
  return {
    type: UPDATE_PLAYER_DATA,
    payload: data,
  };
};

export const setConnection = (component, isConnected) => ({
  type: SET_CONNECTION,
  payload: { component, isConnected },
});

export const setVideoId = (videoId) => ({
  type: SET_VIDEO_ID,
  payload: videoId,
});

export const setTranscript = (transcript) => ({
  type: SET_TRANSCRIPT,
  payload: transcript,
});

export const setError = (error) => ({
  type: SET_ERROR,
  payload: error,
});

export { store };
