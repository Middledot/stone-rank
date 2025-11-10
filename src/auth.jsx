// PKCE auth
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

import { invoke } from "@tauri-apps/api/core";

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return window.crypto.subtle.digest('SHA-256', data)
}

function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const CLIENT_ID = '0c337be3f1164b81ac0fb432845ae93d';
const redirectUri = 'http://127.0.0.1:1420';

export async function triggerLogin() {
    // Three functions above create 'codeVerifier'
    // then encode to send
    const codeVerifier  = generateRandomString(64);
    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);

    window.localStorage.setItem('code_verifier', codeVerifier);

    const scope = 'playlist-read-private streaming';
    const authUrl = new URL("https://accounts.spotify.com/authorize")

    const params =  {
        response_type: 'code',
        client_id: CLIENT_ID,
        scope,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
    }

    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
}

export async function triggerResponse() {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');

    if (code != null) {
        // retrieve 'codeVerifier' from intial login
        const codeVerifier = localStorage.getItem('code_verifier');
        if (codeVerifier == null) {
            return;
        }

        const value = await invoke("retrieve_auth", {codeVerifier: codeVerifier, code: code})
            .catch(error => {
                console.log(error);
                return Promise.resolve(error);
            });
        // console.log("load:", value);
        if (value == "damn straight..." || localStorage.getItem("logged_on")) {
            localStorage.setItem("logged_on", true);
        } else {
            localStorage.setItem("logged_on", false);
        }

        // const url = "https://accounts.spotify.com/api/token";
        // const payload = {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/x-www-form-urlencoded',
        //     },
        //     body: new URLSearchParams({
        //         client_id: CLIENT_ID,
        //         grant_type: 'authorization_code',
        //         code,
        //         redirect_uri: redirectUri,
        //         code_verifier: codeVerifier,
        //     }),
        // }


        // const body = await fetch(url, payload);
        // console.log(body);
        // const response = await body.json();

        // localStorage.setItem('access_token', response.access_token);
    }
    localStorage.removeItem('code_verifier')
}
