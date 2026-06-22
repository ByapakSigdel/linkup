import { Redirect } from 'expo-router';

/** The signup form now lives in the front-door carousel; deep links land there. */
export default function RegisterRedirect() {
  return <Redirect href="/welcome?to=auth&mode=signup" />;
}
