import { createContext, useContext } from 'react';

export const PanelVisibleContext = createContext(true);

export function usePanelVisible(): boolean {
  return useContext(PanelVisibleContext);
}
