const functions = require('firebase-functions');
const admin = require('firebase-admin')
const express = require('express');
const app = express();

// Firebase Oauth
var config = {
    apiKey: "AIzaSyA_Qrkz88sGvPc7MKJTrNSp-wEhgqJALfo",
    authDomain: "socialape-7585c.firebaseapp.com",
    databaseURL: "https://socialape-7585c.firebaseio.com",
    projectId: "socialape-7585c",
    storageBucket: "socialape-7585c.appspot.com",
    messagingSenderId: "612462928108",
    appId: "1:612462928108:web:be75ab3a1957f7a81445c9"
  };

const firebase = require('firebase');
firebase.initializeApp(config);
admin.initializeApp();

const db = admin.firestore();


// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

// Get Screams
app.get('/screams', (req, res) => {
    admin
        .firestore()
        .collection('screams')
        .orderBy('createdAt', 'desc')
        .get()
        .then((data) => {
            let screams = [];
            data.forEach(doc => {
                screams.push({
                    screamId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt
                });
            });
            return res.json(screams);
    })
    .catch(err => console.error(err));   
})

// Create A Scream
app.post('/scream', (req, res) => {
    if(req.method !== 'POST'){
        return res.status(400).json({ error:'Method not allowed'});
    };
    const newScream = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        createdAt: new Date().toISOString()
    };
    admin
        .firestore()
        .collection('screams')
        .add(newScream)
        .then((doc) => {
            res.json({ message: `document ${doc.id} created succesfully`});
        })
        .catch(err => {
            res.status(500).json({ error: 'something went wrong'});
            console.error(err);
        })
});

// SignUp Route
app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email, 
        password: req.body.password,
        handle: req.body.handle,
    };
    // Validate
    let token, userId;
    db.doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if(doc.exists){
                return res.status(400).json({ handle: 'this handle is already taken'});   
            } else {
                return firebase
                .auth()
                .createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken()
        })
        .then(idToken => {
            token = idToken;
            const userCredientials= {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            };
            db.doc(`/users/${newUser.handle}`).set(userCredientials);
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if(err.code === 'auth/email-already-in-use'){
                return res.status(400).json({ email: 'Email is already in use' })
            } else {
                return res.status(500).json({ error: err.code});
            }
        });
    // firebase
    // .auth()
    // .createUserWithEmailAndPassword(newUser.email, newUser.password)
    // .then((data) => {
    //     return res
    //     .status(201)
    //     .json({ message: `user ${data.user.uid} signed up succesfully`});
    // })
    // .catch(err => {
    //     console.error(err);
    //     return res.status(500).json({ error: err.code });
    // });
});
    

// htpps://baseurl.com/api
exports.api = functions.https.onRequest(app);