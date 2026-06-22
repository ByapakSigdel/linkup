import { Redirect } from 'expo-router';

/** The login form now lives in the front-door carousel; deep links land there. */
export default function LoginRedirect() {
  return <Redirect href="/welcome?to=auth&mode=login" />;
}
