import type { Dispatch } from "react";

export interface OneVsOneScheduleAdminBaseState {
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  isClearing: boolean;
  isImporting: boolean;
  isUpdatingActivation: boolean;
}

export type OneVsOneScheduleAdminBaseAction =
  | { type: "SET_FIELD_COUNT"; payload: number }
  | { type: "SET_FIELD_START_OFFSET"; payload: number }
  | { type: "SET_IS_CLEARING"; payload: boolean }
  | { type: "SET_IS_IMPORTING"; payload: boolean }
  | { type: "SET_IS_UPDATING_ACTIVATION"; payload: boolean };

/**
 * Handles the common base actions shared by all 1v1 schedule admin reducers.
 * Returns the updated state if the action was handled, or null if unrecognized.
 */
export const reduceOneVsOneScheduleAdminBaseAction = <
  TState extends OneVsOneScheduleAdminBaseState,
>(
  state: TState,
  action: OneVsOneScheduleAdminBaseAction
): TState | null => {
  switch (action.type) {
    case "SET_FIELD_COUNT":
      return { ...state, fieldCount: Math.max(1, action.payload) };
    case "SET_FIELD_START_OFFSET":
      return { ...state, fieldStartOffsetSeconds: Math.max(0, action.payload) };
    case "SET_IS_CLEARING":
      return { ...state, isClearing: action.payload };
    case "SET_IS_IMPORTING":
      return { ...state, isImporting: action.payload };
    case "SET_IS_UPDATING_ACTIVATION":
      return { ...state, isUpdatingActivation: action.payload };
    default:
      return null;
  }
};

export const createScheduleAdminDispatchers = <
  TAction extends OneVsOneScheduleAdminBaseAction,
>(
  dispatch: Dispatch<TAction>
) => ({
  setIsClearing: (value: boolean) =>
    dispatch({ type: "SET_IS_CLEARING", payload: value } as TAction),
  setIsImporting: (value: boolean) =>
    dispatch({ type: "SET_IS_IMPORTING", payload: value } as TAction),
  setIsUpdatingActivation: (value: boolean) =>
    dispatch({
      type: "SET_IS_UPDATING_ACTIVATION",
      payload: value,
    } as TAction),
});
