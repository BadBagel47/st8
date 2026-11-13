// Constants from libretro.h (MIT licensed, see public/licenses/libretro-MIT.txt).

export const ENV = {
  GET_CAN_DUPE: 3,
  SHUTDOWN: 7,
  GET_SYSTEM_DIRECTORY: 9,
  SET_PIXEL_FORMAT: 10,
  GET_VARIABLE: 15,
  SET_VARIABLES: 16,
  GET_VARIABLE_UPDATE: 17,
  GET_CORE_ASSETS_DIRECTORY: 30,
  GET_SAVE_DIRECTORY: 31,
  SET_SYSTEM_AV_INFO: 32,
  SET_GEOMETRY: 37,
  GET_LANGUAGE: 39,
} as const;

export const PIXEL_FORMAT = {
  RGB1555: 0,
  XRGB8888: 1,
  RGB565: 2,
} as const;

export const DEVICE_JOYPAD = 1;

export const MEMORY = {
  SAVE_RAM: 0,
  SYSTEM_RAM: 2,
} as const;

/** libretro joypad button ids (bit positions in a button mask). */
export const BUTTON = {
  B: 0,
  Y: 1,
  SELECT: 2,
  START: 3,
  UP: 4,
  DOWN: 5,
  LEFT: 6,
  RIGHT: 7,
  A: 8,
  X: 9,
  L: 10,
  R: 11,
} as const;

export type ButtonName = keyof typeof BUTTON;
