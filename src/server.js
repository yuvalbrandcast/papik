const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const host = 'http://localhost';
const port = 5757;
const serverUrl = `${host}:${port}`;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get('/', (req, res) => {
    return res.status(200).sendFile(path.join(__dirname, 'index.html'));
});
app.post('/generate', (req, response, next) => {
    const { host, username, password, key } = req.body;

    console.log(host, username, password, key);

    if (host.indexOf('https://app.brandcast.io') > -1) {
        return res.status(401).send({ error: 'Not authorized' });
    }

    let token = '';
    const getAauthHeaders = () => ({
        Authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
    });

    const checkStatus = _res => {
        if (_res.ok) {
            return _res.json();
        } else {
            const { status, statusText } = _res;
            return _res.json()
                .then(error => {
                    throw { status, statusText, error };
                });
        }
    };

    fetch(`${host}/api/rest-auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        })
        .then(checkStatus)
        .then(authData => {
            console.log(authData);
            token = authData.token;
            return fetch(`${host}/api/graphql/`, {
                method: 'POST',
                headers: getAauthHeaders(),
                body: JSON.stringify({
                    query:
                        '{\n  user {\n    account_profile {\n      id\n      account_id\n    }\n  }\n}',
                }),
            });
        })
        .then(checkStatus)
        .then(gqlData => {
            console.log(gqlData);
            const {
                data: {
                    user: {
                        account_profile: [{ account_id }],
                    },
                },
            } = gqlData;

            console.log(account_id);
            return fetch(`${host}/api/apiactor/`, {
                method: 'POST',
                headers: getAauthHeaders(),
                body: JSON.stringify({ account_id, name: key }),
            });
        })
        .then(checkStatus)
        .then(resApiActor => {
            const apikey = resApiActor.token;
            response.status(200).send({ apikey });
        })
        .catch(err => {
            console.error(err);
            response.status(err.status).send({ error: JSON.stringify(err.error) });
        });
});

const errorHandler = (err, req, res, next) => {
    res.status(500);
    res.render('error', { error: err });
};

app.use(errorHandler);

app.listen(port, server => {
    console.log(`Server is listening on ${serverUrl}`);
});
