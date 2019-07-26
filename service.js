
const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const port = 80;
const env = process.env['NODE_ENV'];
const Redlock = require('redlock');
// Start local redis instance in docker: docker run -p 6379:6379 redis
const redis = require("redis");
// Start local zookeeper instance in docker: docker run -p 2181:2181 -p 2888:2888 -p 3888:3888 zookeeper
// const zookeeper = require('node-zookeeper-client');

let redisHost = '127.0.0.1';

console.log(`NODE_ENV ${env}`);
if (env !== 'local') {
  redisHost = 'redis-master';
}

redisClient = redis.createClient({
  host: redisHost
});

const redlock = new Redlock(
  [redisClient],
  {
    driftFactor: 0.01,
    retryCount: 10,
    retryDelay: 200,
    retryJitter: 200
  }
);

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


app.get('/balance', (req, res) => {
  redisClient.get('balance', function (error, reply) {
    let balance = parseInt(reply);
    if (isNaN(balance)) {
      balance = 0;
    }
    let data = {
      balance: balance
    };
    res.send(JSON.stringify(data));
  });
});

app.post('/deposit', (req, res) => {
  const amount = parseInt(req.body.amount);

  redlock.lock('myaccount', 15 * 1000).then((lock) => {
    console.log('Obtain Lock');
    redisClient.get('balance', function (error, reply) {
      let balance = parseInt(reply);
      if (isNaN(balance)) {
        balance = 0;
      }

      setTimeout(function () {
        balance += amount;
        redisClient.set('balance', balance.toString(), redis.print);
        lock.unlock(function (err) {
          console.error(err);
        });
        res.send('OK');
      }, 10 * 1000);
    });
  }).catch((err) => {
    console.error(err);
    res.send('LOCKED');
  });
});

app.use('/web', express.static('web'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
