import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "config/store";
import { LumenSignerInitialState, Setting } from "types/types";

const initialState: LumenSignerInitialState = {
  bipPath: undefined,
};

const lumenSignerSlice = createSlice({
  name: "lumensigner",
  initialState,
  reducers: {
    updateLumenSignerAction: (state, action: PayloadAction<Setting>) => ({
      ...state,
      ...action.payload,
    }),
  },
});

export const settingsSelector = (state: RootState) => state.settings;

export const { reducer } = lumenSignerSlice;
export const { updateLumenSignerAction } = lumenSignerSlice.actions;
