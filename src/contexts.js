import { useContext, createContext } from 'react';

export const LoginContext = createContext(undefined);

export function useLogin() {
  let def = useContext(LoginContext);

  if (def == undefined) {
    throw new Error("useLogin must be used in the Login Context");
  }

  return def;
}
