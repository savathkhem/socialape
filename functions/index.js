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

// middleware
const FBAuth = (req, res, next) => {
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error ('No token found')
        return res.status(403).json({ error: 'Unauthorized'});
    }

    admin.auth().verifyIdToken(idToken)
    .then(decodeToken => {
        req.user = decodedToken;
        console.log(docodedToken);
        return db.collection('user')
            .where('userId', "==", req.user.uid)
            .limit(1)
            .get();
    })
    .then(data => {
        req.user.handle = data.docs[0].data().handle;
        return next();
    })
    .catch(err => {
        console.error('Error while verifying token ', err);
        return res.status(403).json(err);
    })
}

// Post one Scream with middleware
app.post('/scream', FBAuth, (req, res) => {
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

const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(regEx)) return true;
    else return false;
}

const isEmpty = (string) => {
    if(string.trim() === "") return true;
    else return false;
}

// SignUp Route
app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email, 
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    let errors = {};

    if (isEmpty(newUser.email)) {
        errors.email = 'Must not be empty'
    } else if(!isEmail(newUser.email)){
        errors.email = 'Must be a valid email address'
    }

    if (isEmpty(newUser.password)) errors.password = 'Must not be empty'
    if (newUser.password != newUser.confirmPassword) errors.confirmPassword = 'Passwords must match';
    if (isEmpty(newUser.handle)) errors.handle = 'Must not be empty'

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

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
});  

app.post('/login', (req, res) => {

    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {};

    if(isEmpty(user.email)) errors.email = 'Must not be empty';
    if(isEmpty(user.password)) errors.password = 'Must not be empty';

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.json({token});
        })
        .catch(err => {
            console.error(err);
            if(err.code === 'auth/wrong-password'){
                return res.status(403).json({ general: 'Wrong credientials, please try again'})
            } else return res.status(500).json({ error: err.code });
        });
});

// htpps://baseurl.com/api
exports.api = functions.https.onRequest(app);