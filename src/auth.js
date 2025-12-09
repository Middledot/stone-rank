import { invoke } from "@tauri-apps/api/core";
import { call } from "./api.js"

// PKCE auth
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
    // Q: why async?
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
    localStorage.removeItem("access_token");  // TODO: figure out long term token storage!!
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
        if (value !== "err") {
            // console.log("tag, ur it,", value !== "err")
            localStorage.setItem("logged_on", true);
            // TODO: separate retrieve_access_token function?
            localStorage.setItem("access_token", value);
        } else {
            localStorage.setItem("logged_on", false);
        }
    }
    localStorage.removeItem('code_verifier')
}

export async function getProfile() {
    let token = localStorage.getItem('access_token');
    if (token == "undefined" || token == null) {
        return ["Not Logged In (Jo Doe)", "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg"]
    }

    // TODO: generalize this api handling
    return await call('/me', token).then(data => {
        return [data.display_name, data.images.url || "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg"];
    })
    .catch(_ => {
        // This catch block will handle network errors or errors explicitly thrown in the .then block
        return ["Not Logged In (Jo Doe)", "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg"]
    });
}