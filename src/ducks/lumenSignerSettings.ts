import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "config/store";
import { LumenSignerSettingsInitialState, Setting } from "types/types";

const initialState: LumenSignerSettingsInitialState = {
  bipPath: undefined,
};

const lumenSignerSettingsSlice = createSlice({
  name: "lumenSignerSettings",
  initialState,
  reducers: {
    updateLumenSignerSettingsAction: (
      state,
      action: PayloadAction<Setting>,
    ) => ({
      ...state,
      ...action.payload,
    }),
  },
});

export const settingsSelector = (state: RootState) => state.settings;

export const { reducer } = lumenSignerSettingsSlice;
export const { updateLumenSignerSettingsAction } =
  lumenSignerSettingsSlice.actions;
