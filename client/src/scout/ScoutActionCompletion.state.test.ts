import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {scoutReducer, type ScoutState} from './state';

const start=():ScoutState=>({messages:[{id:'user-1',role:'user',content:'Update my profile',timestamp:'2026-09-15T12:00:00Z'}],status:'executing_action',error:null,lastActions:[{type:'SAVE_PROFILE',payload:{profilePatch:{firstName:'Example'}}}]});
beforeEach(()=>vi.stubEnv('DEV',false));
afterEach(()=>vi.unstubAllEnvs());

describe('visible Scout conversation execution outcomes',()=>{
  for(const message of [
    'Cancelled. This action was not submitted.',
    'Sign in to complete this action.',
    'Cancelled. This action was not submitted. The earlier action may already be complete; check its status.',
    'Sign in to complete this action. The earlier action may already be complete; check its status.',
    'Scout could not confirm this action. Check its current status before trying again.',
    'Scout could not confirm that this action completed.',
    'Scout could not confirm that your profile was saved. Check your profile before trying again.',
  ]){
    it(`keeps the actual outcome in the transcript: ${message}`,()=>{
      const state=scoutReducer(start(),{type:'ERROR',error:message});
      expect(state.messages).toHaveLength(2);
      expect(state.messages.at(-1)).toMatchObject({role:'assistant',content:message});
      expect(state.error).toBe(message);
      expect(state.lastActions).toEqual([]);
      const idle=scoutReducer(state,{type:'SET_STATUS',status:'idle'});
      expect(idle.messages.at(-1)?.content).toBe(message);
      expect(idle.messages.some(m=>m.content==='Saved. Your profile has been updated.')).toBe(false);
    });
  }
  for(const message of ['SQL private profile payload','Cancelled. This action was not submitted. private payload=secret']){
    it(`never persists unsafe error details in the visible transcript: ${message}`,()=>{
      const state=scoutReducer(start(),{type:'ERROR',error:message});
      expect(state.messages.at(-1)?.content).toBe('That did not go through. Try again, or say it a little differently.');
      expect(state.error).not.toContain('private');
    });
  }
  it('keeps a confirmed success acknowledgement unchanged',()=>{
    const state=scoutReducer(start(),{type:'SERVER_RESPONSE',message:{id:'saved-1',role:'assistant',content:'Saved. Your profile has been updated.',timestamp:'2026-09-15T12:01:00Z'}});
    expect(state.messages.at(-1)?.content).toBe('Saved. Your profile has been updated.');
    expect(state.error).toBeNull();expect(state.status).toBe('idle');
  });
});
