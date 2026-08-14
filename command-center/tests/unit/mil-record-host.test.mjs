import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CRM_PRODUCTION_HOST,
  MIL_RECORD_ORIGIN,
  buildMilRecordUrl,
  isCrmProductionHost,
} from '../../src/config/milRecordHost.js';

describe('MIL record host offload', () => {
  it('treats only app.bhfos.com as CRM production', () => {
    assert.equal(CRM_PRODUCTION_HOST, 'app.bhfos.com');
    assert.equal(MIL_RECORD_ORIGIN, 'https://mil.bhfos.com');
    assert.equal(isCrmProductionHost('app.bhfos.com'), true);
    assert.equal(isCrmProductionHost('APP.BHFOS.COM'), true);
    assert.equal(isCrmProductionHost('mil.bhfos.com'), false);
    assert.equal(isCrmProductionHost('localhost'), false);
  });

  it('preserves media and creator paths when building the MIL URL', () => {
    assert.equal(
      buildMilRecordUrl({ pathname: '/media/all', search: '', hash: '' }),
      'https://mil.bhfos.com/media/all',
    );
    assert.equal(
      buildMilRecordUrl({
        pathname: '/media/review',
        search: '?filter=reel',
        hash: '',
      }),
      'https://mil.bhfos.com/media/review?filter=reel',
    );
    assert.equal(
      buildMilRecordUrl({ pathname: '/creator', search: '', hash: '#session=x' }),
      'https://mil.bhfos.com/creator#session=x',
    );
  });
});
