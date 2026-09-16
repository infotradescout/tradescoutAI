import {describe, expect, it} from 'vitest';
import {buildScoutResultContractV1} from '../scout/scoutResultContractV1';
import {scoutAllowedActionToAction} from '../../client/src/scout/actionValidation';
import type {ScoutActionContract} from '../../shared/types/scout';

const save: ScoutActionContract = {type:'SAVE_PROFILE',label:'Save profile update',primary:true,payload:{profilePatch:{firstName:'Example'},requiresApproval:true}};
const open: ScoutActionContract = {type:'NAVIGATE',label:'Open profile settings',to:'/profile-settings'};
const build=(actions:ScoutActionContract[],suggestedActions:string[])=>buildScoutResultContractV1({requestMessage:'Set my name to Example Tester',source:{intent:'profile_update'},answer:'Review your draft.',actions,suggestedActions});

describe('Scout action labels retain their real operation',()=>{
  for(const suggestion of ['Save profile update','save profile update','  SAVE  profile\tupdate  ']){
    it(`never shadows a profile save with a same-labelled chat suggestion: ${JSON.stringify(suggestion)}`,()=>{
      const result=build([save,open],[suggestion,'Open profile settings','Change the draft']);
      expect(result.allowed_actions.filter(a=>/save\s+profile/i.test(a.label))).toHaveLength(1);
      const real=result.allowed_actions.find(a=>a.type==='SAVE_PROFILE')!;
      expect(real.requires_confirmation).toBe(true);
      expect(scoutAllowedActionToAction(real)).toMatchObject({type:'SAVE_PROFILE',primary:true,payload:{profilePatch:{firstName:'Example'},requiresApproval:true}});
      expect(result.allowed_actions.filter(a=>a.label==='Open profile settings')).toHaveLength(1);
      expect(result.allowed_actions.find(a=>a.label==='Change the draft')).toMatchObject({type:'ASK_SCOUT',prompt:'Change the draft',requires_confirmation:false});
    });
  }
  it('preserves navigation instead of turning its label into a chat request',()=>{
    const result=build([open],['Open profile settings']);
    expect(result.allowed_actions).toHaveLength(1);
    expect(scoutAllowedActionToAction(result.allowed_actions[0])).toMatchObject({type:'NAVIGATE',to:'/profile-settings'});
  });
  it('retains a genuine suggestion when no typed action owns its label',()=>{
    expect(build([],['Save profile update']).allowed_actions).toEqual([expect.objectContaining({type:'ASK_SCOUT',label:'Save profile update'})]);
  });
  it('does not merge distinct typed operations merely because their display labels match',()=>{
    const result=build([{type:'NAVIGATE',label:'Open item',to:'/exchange/item-a'},{type:'NAVIGATE',label:'Open item',to:'/exchange/item-b'}],['Open item']);
    expect(result.allowed_actions).toHaveLength(2);
    expect(result.allowed_actions.map(a=>a.target)).toEqual(['/exchange/item-a','/exchange/item-b']);
  });
  it('keeps broad-help ambiguity options wired to their own declared actions',()=>{
    const result=buildScoutResultContractV1({requestMessage:'Help me',source:{},answer:'Choose a direction.',actions:[],suggestedActions:[]});
    expect(result.ambiguity_options).toHaveLength(3);
    for(const option of result.ambiguity_options)expect(result.allowed_actions.find(a=>a.action_id===option.action_id)).toMatchObject({type:'ASK_SCOUT',label:option.label,requires_confirmation:false});
  });
});
