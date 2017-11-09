const mockery = require('mockery');
const { expect } = require('chai');
const azure = require('./utils/azure');
const https = require('./utils/https');

const headers = {

}

const reqs = [{
  body: {
    category: 'newsletter',
  },
  rawBody: 'test1',
  headers,
}, {
  body: {
    category: 'newsletter',
  },
  rawBody: 'test2',
  headers,
}]

describe('proxy', () => {
  let proxy;

  before(() => {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });
    mockery.registerMock('https', https);
    mockery.registerMock('azure-storage', azure);
    proxy = require('../src/index');
  });

  after(() => {
    mockery.disable();
  });

  it('should be able to send a new mail', async() => {
    await proxy({ req: reqs[0]});
    const data = azure.getData();
    expect(data).to.be.eql([
      {
        "PartitionKey": {
          "_": "newsletter"
        },
        "RowKey": {
          "_": "G08OmFGXGZjnMgeFRMlrNsPQHO33yqMyNZ1vHYNWcBQ="
        },
        "requestBody": {
          "_": "test1"
        },
        "requestHeaders": {
          "_": "{}"
        },
        "responseBody": {
          _: undefined
        },
        "responseHeaders": {
          _: undefined
        },
        "statusCode": {
           _: undefined
        },
        "error": {
           _: undefined
        },
        "send": {
          "_": false
        },
        "count": {
          "_": 1
        }
      }
    ]);
  });
});
