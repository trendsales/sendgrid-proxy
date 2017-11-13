const mockery = require('mockery');
const { expect } = require('chai');
const azure = require('./utils/azure');
const https = require('./utils/https');

process.env.UNIQUE_CATEGORIES = 'newsletter'

const headers = {

}

const reqs = [{
  body: {
    categories: ['newsletter'],
  },
  rawBody: 'test1',
  headers,
}, {
  body: {
    categories: ['newsletter'],
  },
  rawBody: 'test2',
  headers,
}, {
  body: {
    categories: ['not-newsletter'],
  },
  rawBody: 'test3',
  headers,
}];

const createContext = (req) => ({
  req,
  done: () => {},
  log: () => {},
});

const cleanup = (obj) => obj ? Object.keys(obj).reduce((output, i) => {
  output[i] = obj[i]._;
  return output;
}, {}) : undefined;

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
    await proxy(createContext(reqs[0]));
    const azureData = azure.getData().map(cleanup);
    const httpsData = https.getData();
    expect(azureData).to.be.eql([{
      PartitionKey: 'newsletter',
      RowKey: '1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014',
      requestID: '1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014',
      categories: 'newsletter',
      requestBody: 'test1',
      messageId: 'msg-id',
      requestHeaders: '{}',
      responseBody: 'test data',
      responseHeaders: '{\"X-Message-Id\":\"msg-id\"}',
      statusCode: 204,
      send: true,
      unique: true,
      count: 1,
    }]);
    expect(httpsData).to.have.length(1);
  });

  it('should be able to send multible mails', async() => {
    await proxy(createContext(reqs[1]));
    const azureData = azure.getData().map(cleanup);
    const httpsData = https.getData();
    expect(azureData).to.have.length(2);
    expect(azureData[0].requestBody).to.be.equal('test1');
    expect(azureData[1].requestBody).to.be.equal('test2');
    expect(httpsData).to.have.length(2);
  });

  it('should not resend mails marked as unique', async () => {
    await proxy(createContext(reqs[1]));
    const azureData = azure.getData().map(cleanup);
    const httpsData = https.getData();
    expect(azureData).to.have.length(2);
    expect(azureData[0].count).to.be.equal(1);
    expect(azureData[1].count).to.be.equal(2);
    expect(httpsData).to.have.length(2);
  });

  it('should resend mails not marked as unique', async () => {
    await proxy(createContext(reqs[2]));
    await proxy(createContext(reqs[2]));
    const azureData = azure.getData().map(cleanup);
    const httpsData = https.getData();
    expect(azureData).to.have.length(3);
    expect(azureData[0].count).to.be.equal(1);
    expect(azureData[1].count).to.be.equal(2);
    expect(azureData[2].count).to.be.equal(2);
    expect(httpsData).to.have.length(4);
  });
});
