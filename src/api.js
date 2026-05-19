export async function call(path, token) {
    let data = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: {
            Authorization: 'Bearer ' + token
        }
    }); 
    console.log("am I still being called")
    return data
    
    // .then(response => {
    //     if (response.status === 401) {
    //         console.error('Authentication failed: 401 Unauthorized');
    //         throw new Error('Unauthorized');
    //     } else if (!response.ok) {
    //         console.error(`HTTP error! Status: ${response.status}`);
    //         throw new Error(`HTTP error! Status: ${response.status}`);
    //     }
    //     return response.json();
    // })
}