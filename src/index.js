require('babel-polyfill');
const azure = require('azure-storage');
const crypto = require('crypto');
const https = require('https');
const tableSvc = azure.createTableService();
const tableName = process.env.TABLENAME || 'sendgrid-proxy';

const createTable = () => new Promise((resolve, reject) => {
  tableSvc.createTableIfNotExists(tableName, (error, result, response) => {
    if(error){
      reject(err);
    } else {
      resolve();
    }
  });
});

const insert = (entry) => new Promise((resolve, reject) => {
  tableSvc.insertEntity(tableName, entry, (error, result, response) => {
    if(error){
      reject(error);
    } else {
      resolve();
    }
  });
});

const update = (entry) => new Promise((resolve, reject) => {
  tableSvc.replaceEntity(tableName, entry, (error, result, response) => {
    if(error){
      reject(error);
    } else {
      resolve();
    }
  });
});

const get = (partitionKey, rowKey) => new Promise((resolve, reject) => {
  tableSvc.retrieveEntity(tableName, partitionKey, rowKey, (error, result, response) => {
    if(error){
      reject(error);
    } else {
      resolve(result);
    }
  });
});

const send = (headers, body) => new Promise((resolve, reject) => {
  var options = {
    ...headers,
    host: '',
    path: '',
  };

  let responseBody = '';
  let responseHeaders = {};
  let statusCode;

  resolve();

  /*const req = https.request(options, (res) => {
    responseHeaders = res.headers;
    statusCode = res.statusCode;
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      responseBody += chunk;
    });
    res.on('end', (chunk) => {
      resolve({
      headers: responseHeaders,
      body: responseBody,
      statusCode,
      })
    });
  });

  req.on('error', function(error) {
    reject({
      error,
      headers: responseHeaders,
      body: responseBody,
      statusCode,
    });
  });

  req.write(body);
  req.end();*/
});

module.exports = async (context) => {
  const body = context.req.rawBody;
  const headers = context.req.headers;

  const partitionKey = context.req.body.category;
  const rowKey = crypto.createHash('sha256').update(body).digest('base64');

  const current = {
    PartitionKey: {'_' : partitionKey},
    RowKey: {'_': rowKey},
    requestBody: {'_': body},
    requestHeaders: {'_': JSON.stringify(headers)},
    responseBody: {'_': ''},
    responseHeaders: {'_': JSON.stringify({})},
    statusCode: {'_': -1},
    send: {'_': false},
    count: {'_': 1},
  };

  await createTable();
  const previous = await get(partitionKey, rowKey);
  if (previous) {
    current.count._ = previous.count;
    await update(current);
  } else {
    try {
      const response = await send(headers, body);
      current.responseBody._ = response.body;
      current.statusCode._ = response.statusCode;
      current.responseHeaders._ = JSON.stringify(response.headers);
      current.send._ = true;
    } catch (error) {
      current.responseBody._ = error.body;
      current.statusCode._ = error.statusCode;
      current.responseHeaders._ = JSON.stringify(error.headers);
      current.error = {
        _: error.error,
      };
    }
    await insert(current);
  }
};
