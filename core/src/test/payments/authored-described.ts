import { app, mockEventStreamWebSocket } from '../common';
import { testDescription } from '../samples';
import nock from 'nock';
import request from 'supertest';
import assert from 'assert';
import { IDBPaymentDefinition, IDBPaymentInstance, IEventPaymentDefinitionCreated, IEventPaymentInstanceCreated } from '../../lib/interfaces';
import * as utils from '../../lib/utils';

describe('Payment definitions: authored - described', async () => {

  let paymentDefinitionID: string;
  const timestamp = utils.getTimestamp();

  describe('Create described payment definition', () => {

    it('Checks that the payment definition can be added', async () => {

      nock('https://apigateway.kaleido.io')
        .post('/createDescribedPaymentDefinition?kld-from=0x0000000000000000000000000000000000000001&kld-sync=false')
        .reply(200);

      nock('https://ipfs.kaleido.io')
        .post('/api/v0/add')
        .reply(200, { Hash: testDescription.schema.ipfsMultiHash });

      const result = await request(app)
        .post('/api/v1/payments/definitions')
        .send({
          name: 'authored - described',
          author: '0x0000000000000000000000000000000000000001',
          descriptionSchema: testDescription.schema.object
        })
        .expect(200);
      assert.deepStrictEqual(result.body.status, 'submitted');
      paymentDefinitionID = result.body.paymentDefinitionID;

      const getPaymentDefinitionsResponse = await request(app)
        .get('/api/v1/payments/definitions')
        .expect(200);
      const paymentDefinition = getPaymentDefinitionsResponse.body.find((paymentDefinition: IDBPaymentDefinition) => paymentDefinition.name === 'authored - described');
      assert.strictEqual(paymentDefinition.paymentDefinitionID, paymentDefinitionID);
      assert.strictEqual(paymentDefinition.author, '0x0000000000000000000000000000000000000001');
      assert.strictEqual(paymentDefinition.confirmed, false);
      assert.deepStrictEqual(paymentDefinition.descriptionSchema, testDescription.schema.object);
      assert.strictEqual(paymentDefinition.name, 'authored - described');
      assert.strictEqual(typeof paymentDefinition.timestamp, 'number');

      const getPaymentDefinitionResponse = await request(app)
        .get(`/api/v1/payments/definitions/${paymentDefinitionID}`)
        .expect(200);
      assert.deepStrictEqual(paymentDefinition, getPaymentDefinitionResponse.body);
    });

    it('Checks that the event stream notification for confirming the payment definition creation is handled', async () => {
      nock('https://ipfs.kaleido.io')
      .get(`/ipfs/${testDescription.schema.ipfsMultiHash}`)
      .reply(200, testDescription.schema.object);
      
      const eventPromise = new Promise((resolve) => {
        mockEventStreamWebSocket.once('send', message => {
          assert.strictEqual(message, '{"type":"ack","topic":"dev"}');
          resolve();
        })
      });
      const data: IEventPaymentDefinitionCreated = {
        paymentDefinitionID: utils.uuidToHex(paymentDefinitionID),
        author: '0x0000000000000000000000000000000000000001',
        name: 'authored - described',
        descriptionSchemaHash: testDescription.schema.ipfsSha256,
        timestamp: timestamp.toString()
      };
      mockEventStreamWebSocket.emit('message', JSON.stringify([{
        signature: utils.contractEventSignatures.DESCRIBED_PAYMENT_DEFINITION_CREATED,
        data,
        blockNumber: '123',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
      }]));
      await eventPromise;
    });

    it('Checks that the payment definition is confirmed', async () => {
      const getPaymentDefinitionsResponse = await request(app)
        .get('/api/v1/payments/definitions')
        .expect(200);
      const paymentDefinition = getPaymentDefinitionsResponse.body.find((paymentDefinition: IDBPaymentDefinition) => paymentDefinition.name === 'authored - described');
      assert.strictEqual(paymentDefinition.paymentDefinitionID, paymentDefinitionID);
      assert.strictEqual(paymentDefinition.author, '0x0000000000000000000000000000000000000001');
      assert.strictEqual(paymentDefinition.confirmed, true);
      assert.deepStrictEqual(paymentDefinition.descriptionSchema, testDescription.schema.object);
      assert.strictEqual(paymentDefinition.name, 'authored - described');
      assert.strictEqual(paymentDefinition.timestamp, timestamp);
      assert.strictEqual(paymentDefinition.blockchainData.blockNumber, 123);
      assert.strictEqual(paymentDefinition.blockchainData.transactionHash, '0x0000000000000000000000000000000000000000000000000000000000000000');

      const getPaymentDefinitionResponse = await request(app)
        .get(`/api/v1/payments/definitions/${paymentDefinitionID}`)
        .expect(200);
      assert.deepStrictEqual(paymentDefinition, getPaymentDefinitionResponse.body);
    });

  });

  describe('Payment instances', async () => {

    let paymentInstanceID: string;

    it('Checks that a payment instance can be created', async () => {

      nock('https://apigateway.kaleido.io')
        .post('/createDescribedPaymentInstance?kld-from=0x0000000000000000000000000000000000000001&kld-sync=false')
        .reply(200);

      nock('https://ipfs.kaleido.io')
        .post('/api/v0/add')
        .reply(200, { Hash: testDescription.sample.ipfsMultiHash })

      const result = await request(app)
        .post('/api/v1/payments/instances')
        .send({
          paymentDefinitionID,
          author: '0x0000000000000000000000000000000000000001',
          description: testDescription.sample.object,
          recipient: '0x0000000000000000000000000000000000000002',
          amount: 10
        })
        .expect(200);
      assert.deepStrictEqual(result.body.status, 'submitted');
      paymentInstanceID = result.body.paymentInstanceID;

      const getPaymentInstancesResponse = await request(app)
        .get('/api/v1/payments/instances')
        .expect(200);
      const paymentInstance = getPaymentInstancesResponse.body.find((paymentInstance: IDBPaymentInstance) => paymentInstance.paymentInstanceID === paymentInstanceID);
      assert.strictEqual(paymentInstance.author, '0x0000000000000000000000000000000000000001');
      assert.strictEqual(paymentInstance.paymentDefinitionID, paymentDefinitionID);
      assert.strictEqual(paymentInstance.descriptionHash, testDescription.sample.ipfsSha256);
      assert.deepStrictEqual(paymentInstance.description, testDescription.sample.object);
      assert.strictEqual(paymentInstance.recipient, '0x0000000000000000000000000000000000000002');
      assert.strictEqual(paymentInstance.amount, 10);
      assert.strictEqual(paymentInstance.confirmed, false);
      assert.strictEqual(typeof paymentInstance.timestamp, 'number');

      const getPaymentInstanceResponse = await request(app)
        .get(`/api/v1/payments/instances/${paymentInstanceID}`)
        .expect(200);
      assert.deepStrictEqual(paymentInstance, getPaymentInstanceResponse.body);

    });

    it('Checks that the event stream notification for confirming the payment instance creation is handled', async () => {
      const eventPromise = new Promise((resolve) => {
        mockEventStreamWebSocket.once('send', message => {
          assert.strictEqual(message, '{"type":"ack","topic":"dev"}');
          resolve();
        })
      });
      const data: IEventPaymentInstanceCreated = {
        paymentDefinitionID: utils.uuidToHex(paymentDefinitionID),
        author: '0x0000000000000000000000000000000000000001',
        paymentInstanceID: utils.uuidToHex(paymentInstanceID),
        descriptionHash: testDescription.sample.ipfsSha256,
        amount: '10',
        recipient: '0x0000000000000000000000000000000000000002',
        timestamp: timestamp.toString()
      };
      mockEventStreamWebSocket.emit('message', JSON.stringify([{
        signature: utils.contractEventSignatures.DESCRIBED_PAYMENT_INSTANCE_CREATED,
        data,
        blockNumber: '123',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
      }]));
      await eventPromise;
    });

    it('Checks that the payment instance is confirmed', async () => {
      const getAssetInstancesResponse = await request(app)
        .get('/api/v1/payments/instances')
        .expect(200);
      const paymentInstance = getAssetInstancesResponse.body.find((paymentInstance: IDBPaymentInstance) => paymentInstance.paymentInstanceID === paymentInstanceID);
      assert.strictEqual(paymentInstance.author, '0x0000000000000000000000000000000000000001');
      assert.strictEqual(paymentInstance.recipient, '0x0000000000000000000000000000000000000002');
      assert.strictEqual(paymentInstance.paymentDefinitionID, paymentDefinitionID);
      assert.strictEqual(paymentInstance.descriptionHash, testDescription.sample.ipfsSha256);
      assert.deepStrictEqual(paymentInstance.description, testDescription.sample.object);
      assert.strictEqual(paymentInstance.confirmed, true);
      assert.strictEqual(paymentInstance.amount, 10);
      assert.strictEqual(paymentInstance.timestamp, timestamp);
      assert.strictEqual(paymentInstance.blockchainData.blockNumber, 123);
      assert.strictEqual(paymentInstance.blockchainData.transactionHash, '0x0000000000000000000000000000000000000000000000000000000000000000');

      const getAssetInstanceResponse = await request(app)
        .get(`/api/v1/payments/instances/${paymentInstanceID}`)
        .expect(200);
      assert.deepStrictEqual(paymentInstance, getAssetInstanceResponse.body);
    });

  });

});