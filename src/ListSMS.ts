import fs from "fs";

import parser from 'xml2json';

import {SessionData} from './startSession';
import {restCalls} from "./utils/DefaultRestCalls";
import {ExportFormat} from "./utils/Constants";

const huawei = require('../jslib/public');

async function saveFile(filename: string, data: string) {
  await fs.promises.writeFile(filename, data);
}

export async function getSMSByUsers(sessionData: SessionData,
                                    phone: string,
                                    pageindex: number,
                                    exportFile: string,
                                    exportFormat: ExportFormat,
                                    deleteAfter: boolean) {
    // const count = await getContactSMSPages(sessionData, phone, '', 'hide');
    // if (count === 0) {
    //     console.log(`contact ${phone} does not have messages`);
    //     return;
    // }
  const scram = huawei.CryptoJS.SCRAM();
  const smsNonce = scram.nonce().toString();
  const smsSalt = scram.nonce().toString();
  const nonceStr = smsNonce + smsSalt;
  const encrpt = await huawei.doRSAEncrypt(sessionData, nonceStr);
  const data = await huawei.doRSAEncrypt(sessionData, `<?xml version="1.0" encoding="UTF-8"?><request><phone>${phone}</phone><pageindex>${pageindex}</pageindex><readcount>20</readcount><nonce>${encrpt}</nonce></request>`);
  const resp = await restCalls.sendData(`http://${sessionData.url}/api/sms/sms-list-phone`, 'POST', data, {
    __RequestVerificationToken: sessionData.TokInfo,
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8;enc',
    Cookie: `SessionId=${sessionData.SesInfo}`,
  });
  const pwdret = JSON.parse(parser.toJson(resp));
  const ret = huawei.dataDecrypt(scram, smsNonce, smsSalt, nonceStr, pwdret);

  if (exportFormat !== 'hide') {
    if (exportFormat === 'xml') {
      await saveFile(exportFile, ret);
      console.info(`xml file ${exportFile} created`);
    } else if (exportFormat === 'json') {
      await saveFile(exportFile, parser.toJson(ret));
      console.info(`json file ${exportFile} created`);
    } else {
      const text = parser.toJson(ret);
      const json = JSON.parse(text);
      if (Array.isArray(json.response.messages.message)) {
        json.response.messages.message.forEach((message: any) => {
          console.log(`MessageId: ${message.index} Phone: ${message.phone} Message: ${JSON.stringify(message.content)}`);
        });
      } else {
        const message: any = json.response.messages.message;
        console.log(`MessageId: ${message.index} Phone: ${message.phone} Message: ${JSON.stringify(message.content)}`);
      }
    }
  }

  if (deleteAfter) {
    const text = parser.toJson(ret);
    const json = JSON.parse(text);
    const messages = json.response.messages.message;
    for (let i = 0; i < messages.length; i++) {
      await deleteMessage(sessionData, messages[i].index);
    }
  }
}

export async function getContactSMSPages(sessionData: SessionData,
                                         phone: string,
                                         exportFile: string,
                                         exportFormat: ExportFormat) {
  const data = await huawei.doRSAEncrypt(sessionData, `<?xml version="1.0" encoding="UTF-8"?><request><phone>${phone}</phone></request>`);
  const resp = await restCalls.sendData(`http://${sessionData.url}/api/sms/sms-count-contact`, 'POST', data, {
    __RequestVerificationToken: sessionData.TokInfo,
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8;enc',
    Cookie: `SessionId=${sessionData.SesInfo}`,
  });

  const text = parser.toJson(resp);
  const json = JSON.parse(text);
  let number = Math.floor(json.response.count / 21);
  if (number > 0) {
    number += 1;
  }
  if (exportFormat !== 'hide') {
    if (exportFormat === 'xml') {
      await saveFile(exportFile, resp);
      console.info(`xml file ${exportFile} created`);
    } else if (exportFormat === 'json') {
      await saveFile(exportFile, parser.toJson(resp));
      console.info(`json file ${exportFile} created`);
    } else {
      console.info(`${number}`);
    }
  }
  return number;
}

export async function getSMSPages(sessionData: SessionData,
                                  exportFile: string,
                                  exportFormat: ExportFormat) {
  const resp = await restCalls.fetchData(`http://${sessionData.url}/api/sms/sms-count`, 'GET');
  const text = parser.toJson(resp);
  const json = JSON.parse(text);
  let number = Math.floor((json.response.LocalInbox + json.response.LocalOutbox) / 21);
  if (number > 0) {
    number += 1;
  }
  if (exportFormat !== 'hide') {
    if (exportFormat === 'xml') {
      await saveFile(exportFile, resp);
      console.info(`xml file ${exportFile} created`);
    } else if (exportFormat === 'json') {
      await saveFile(exportFile, parser.toJson(resp));
      console.info(`json file ${exportFile} created`);
    } else {
      console.info(`${number}`);
    }
  }
  return number;
}

export async function deleteMessage(sessionData: SessionData,
                                    messageId: string) {
  const data = await huawei.doRSAEncrypt(sessionData, `<?xml version: "1.0" encoding="UTF-8"?><request><Index>${messageId}</Index></request>`);
  const resp = await restCalls.sendData(`http://${sessionData.url}/api/sms/delete-sms`, 'POST', data, {
    __RequestVerificationToken: sessionData.TokInfo,
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8;enc',
    Cookie: `SessionId=${sessionData.SesInfo}`,
  });
  const text = parser.toJson(resp);
  const json = JSON.parse(text);
  if (json.response !== 'OK') {
    throw new Error(`Delete message error: ${text}`);
  }
  console.info('Message or Contact deleted');
}

export async function sendMessage(sessionData: SessionData,
                                  phones: string,
                                  message: string) {
  const scram = huawei.CryptoJS.SCRAM();
  const smsNonce = scram.nonce().toString();
  const smsSalt = scram.nonce().toString();
  const nonceStr = smsNonce + smsSalt;
  const encrpt = await huawei.doRSAEncrypt(sessionData, nonceStr);
  const data = await huawei.doRSAEncrypt(sessionData, `<?xml version="1.0" encoding="UTF-8"?><request><Index>-1</Index><Phones><Phone>${(phones)}</Phone></Phones><Sca></Sca><Content>${message}</Content><Length>${message.length}</Length><Reserved>1</Reserved><Date>2021-10-27 00:12:24</Date><nonce>${encrpt}</nonce></request>`);
  const resp = await restCalls.sendData(`http://${sessionData.url}/api/sms/send-sms`, 'POST', data, {
    __RequestVerificationToken: sessionData.TokInfo,
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8;enc',
    Cookie: `SessionId=${sessionData.SesInfo}`,
  });
  const text = parser.toJson(resp);
  const json = JSON.parse(text);
  if (json.response !== 'OK') {
    throw new Error(`Delete message error: ${text}`);
  }
  console.info('Message sent');
}


export async function getSMSContacts(sessionData: SessionData,
                                     pageindex: number,
                                     exportFile: string,
                                     exportFormat: ExportFormat) {
  const count = await getSMSPages(sessionData, '', 'hide');
  if (count === 0) {
    console.log('huawei does not have contacts');
    return;
  }
  const scram = huawei.CryptoJS.SCRAM();
  const smsNonce = scram.nonce().toString();
  const smsSalt = scram.nonce().toString();
  const nonceStr = smsNonce + smsSalt;
  const encrpt = await huawei.doRSAEncrypt(sessionData, nonceStr);
  const data = await huawei.doRSAEncrypt(sessionData, `<?xml version: "1.0" encoding="UTF-8"?><request><pageindex>${pageindex}</pageindex><readcount>20</readcount><nonce>${encrpt}</nonce></request>`);
  const resp = await restCalls.sendData(`http://${sessionData.url}/api/sms/sms-list-contact`, 'POST',
        data, {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8;enc',
          __RequestVerificationToken: sessionData.TokInfo,
          Cookie: `SessionId=${sessionData.SesInfo}`,
        });
  const pwdret = JSON.parse(parser.toJson(resp));
  const ret = huawei.dataDecrypt(scram, smsNonce, smsSalt, nonceStr, pwdret);
  if (exportFormat === 'xml') {
    await saveFile(exportFile, ret);
    console.info(`xml file ${exportFile} created`);
  } else if (exportFormat === 'json') {
    await saveFile(exportFile, parser.toJson(ret));
    console.info(`json file ${exportFile} created`);
  } else {
    const text = parser.toJson(ret);
    const json = JSON.parse(text);
    if (Array.isArray(json.response.messages.message)) {
      json.response.messages.message.forEach((message: any) => {
        console.log(`MessageId: ${message.index} Phone: ${message.phone} lastMessage: ${JSON.stringify(message.content)}`);
      });
    } else {
      const message: any = json.response.messages.message;
      console.log(`(MessageId: ${message.index}) Phone: ${message.phone} lastMessage: ${message.content}`);
    }
  }
}