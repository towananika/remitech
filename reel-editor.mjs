import * as R from './reel-workflow.mjs?v=20261023-post-layout';

const labels = {
  title:['REEL','REEL','REEL'],
  bookmark:['ページURLをコピー','Copy page link','페이지 주소 복사'],bookmarkCopied:['このURLをブックマークすると、同じ日付・SNSを直接開けます。','Bookmark this URL to open this date and channel directly.','이 주소를 북마크하면 같은 날짜·SNS를 바로 열 수 있습니다.'],
  noboReset:['元の英文にリセット','Reset to original English','원래 영어로 초기화'],resetConfirm:['もう一度押すとリセット','Press again to reset','한 번 더 누르면 초기화'],resetHelp:['修正分を取り消し、元の英文に戻します。2回押すと共有保存にも反映します。','Undo revisions and restore the original. Press twice to reset shared text.','수정 내용을 취소하고 원래 영어로 되돌립니다. 두 번 누르면 공유 내용에도 반영됩니다.'],
  copiedShort:['コピー済','Copied','복사완료'],
  storyRandom:['ランダムにコピー','Copy a random phrase','랜덤 복사'],storyChoices:['候補を見る','Show phrases','문구 보기'],storyUrl:['リンク先URLをコピー','Copy destination URL','링크 주소 복사'],storyEmpty:['ストーリー用の定型文がありません。','No story phrases available.','스토리 문구가 없습니다.'],storyError:['定型文を読み込めませんでした。更新して再試行してください。','Could not load phrases. Refresh to retry.','문구를 불러오지 못했습니다. 새로고침해 다시 시도하세요.'],
  serverPending:['共有保存機能は本番にまだ反映されていません。作成・共有保存は現在利用できません。デザインは比較ページで確認できます。','Shared saving has not been deployed yet. Creation and shared saving are currently unavailable. Use the comparison page to review the design.','공유 저장 기능이 아직 배포되지 않았습니다. 생성·공유 저장은 현재 사용할 수 없습니다. 비교 페이지에서 디자인을 확인할 수 있습니다.'],
  addDraft:['用意した日英原稿を登録','Add prepared JA / EN text','준비한 일·영 원고 등록'],manualMissing:['用意した日英原稿を登録してください。','Add your prepared Japanese and English text.','준비한 일본어·영어 원고를 등록하세요.'],theme:['週のテーマ','Weekly theme','주간 주제'],arc:['一週間の流れ','Weekly story','한 주의 흐름'],
  confirmDay:['{sns}の投稿文を確定','Confirm {sns} posts','{sns} 게시문 확정'],unconfirmDay:['{sns}の投稿文の確定を解除','Unconfirm {sns} posts','{sns} 게시문 확정 해제'],copyFeeds:['すべてコピー','Copy all','전체 복사'],
  resetShort:['リセット','Reset','초기화'],cancelConfirm:['もう一度押すとキャンセル','Press again to cancel','한 번 더 누르면 취소'],
  clickEdit:['クリックして編集','Click to edit','클릭하여 수정'],
  adminConfirm:['管理者確定','Admin confirm','관리자 확정'],adminUndoConfirm:['管理者確定を解除','Undo admin confirmation','관리자 확정 해제'],reviewerOnly:['確定できるのは管理者またはNOBOです。','Only admins or NOBO can confirm.','관리자 또는 NOBO만 확정할 수 있습니다.'],
  undoConfirm:['確定を解除','Unconfirm','확정 해제'],allConfirmed:['✓ 投稿文すべて確定','✓ All text confirmed','✓ 게시문 전체 확정'],confirmedProgress:['{count}/{total} 確定','{count}/{total} confirmed','{count}/{total} 확정'],
  confirm:['確定','Confirm','확정'],revise:['修正','Edit','수정'],draftEnglish:['英文 · 草案','English · Draft','영어 · 초안'],revisedEnglish:['英文 · NOBO修正','English · Revised','영어 · 수정본'],
  calendarPrev:['1週間前へ','Previous week','1주 전'],calendarNext:['1週間後へ','Next week','1주 후'],checkOverview:['NOBO CALENDAR','NOBO CALENDAR','NOBO CALENDAR'],noDraft:['草案なし','No draft','초안 없음'],revised:['修正済み','Revised','수정 완료'],today:['今日','Today','오늘'],
  holidaySet:['休日に設定','Mark as a holiday','휴일로 설정'],holidayUnset:['休日（クリックで解除）','Holiday (click to remove)','휴일 (클릭하여 해제)'],koreanHoliday:['韓国の祝日：','Korean public holiday: ','한국 공휴일: '],sunday:['日曜日','Sunday','일요일'],
  externalReview:['別文書でNOBO確認済み。本文はこのページには登録されていません。','Checked by NOBO in another document. The text is not stored on this page.','다른 문서에서 NOBO 확인 완료. 본문은 이 페이지에 등록되어 있지 않습니다.'],
  wellDone:['お疲れ様でした。','Thank you for your work.','수고하셨습니다.'],
  scope:['今回の対象は2026年11月30日までです。','The current scope ends on November 30, 2026.','현재 작업 범위는 2026년 11월 30일까지입니다.'],
  date:['日付','Date','날짜'],settings:['AIの投稿方針','AI writing brief','AI 게시물 작성 지침'],saveBrief:['方針を保存','Save brief','지침 저장'],
  brief:['ブランド・読者・語調・避けたい表現','Brand, audience, voice and constraints','브랜드·독자·말투·피할 표현'],
  login:['作成・編集・予約には社内アカウントでログインしてください。','Sign in with a team account to write, edit or book.','생성·편집·예약은 사내 계정으로 로그인하세요.'],loginBtn:['ログイン','Log in','로그인'],
  aiOff:['AIは未接続です。Workerの更新とWorkers AIの接続が必要です。','AI is not connected. Update the Worker and connect Workers AI.','AI 미연결: Worker 업데이트와 Workers AI 연결이 필요합니다.'],
  loading:['読み込み中…','Loading…','불러오는 중…'],generating:['草案を自動作成しています…','Preparing drafts automatically…','초안을 자동 생성하고 있습니다…'],
  refresh:['更新','Refresh','새로고침'],retry:['もう一度読み込む','Retry loading','다시 불러오기'],
  copy:['コピー','Copy','복사'],copied:['コピーしました','Copied','복사했습니다'],
  image:['画像プロンプトを生成してコピー','Generate & copy image prompt','이미지 프롬프트 생성·복사'],imageCopy:['画像プロンプトをコピー','Copy image prompt','이미지 프롬프트 복사'],imageCopied:['画像プロンプトをコピーしました','Image prompt copied','이미지 프롬프트를 복사했습니다'],
  imageRetry:['生成済みです。もう一度ボタンを押すとコピーできます。','Generated. Press the button again to copy.','생성했습니다. 버튼을 다시 눌러 복사하세요.'],
  deadline:['{date}（投稿日前日・韓国時間）からは、NOBO確認前でもコピーできます。','Copy available from {date} (day before posting, Korea time), even before NOBO checks it.','{date} (게시 전날·한국 시간)부터 NOBO 확인 전에도 복사할 수 있습니다.'],
  pending:['NOBO確認待ち','Awaiting NOBO','NOBO 확인 대기'],checked:['NOBO確認済み','Checked by NOBO','NOBO 확인 완료'],check:['問題なし','No changes needed','문제없음'],due:['前日解禁 · 確認待ち','Available · check pending','복사 가능 · 확인 대기'],
  noboEdit:['NOBO · 英文を修正','NOBO · Revise English','NOBO · 영어 수정'],original:['元の英文を表示','Show original English','원래 영어 보기'],correction:['NOBO修正版','NOBO revision','NOBO 수정본'],
  localDraft:['この端末に下書き保存済み','Draft saved on this device','이 기기에 초안 저장됨'],localError:['この端末に保存できません。閉じる前に入力をコピーしてください。','Cannot save on this device. Copy your input before closing.','이 기기에 저장하지 못했습니다. 닫기 전에 입력을 복사하세요.'],resume:['保存した下書きから再開','Resume saved draft','저장한 초안에서 계속'],localClose:['下書きを保存して閉じる','Save draft & close','초안 저장 후 닫기'],shareSave:['修正を共有保存','Save revision for the team','수정본 공유 저장'],
  useLatest:['表示中の原稿に修正を適用','Apply edits to the displayed version','표시된 원고에 수정 적용'],
  book:['予約した','Mark scheduled','예약함'],booked:['予約済み · 解除','Scheduled · undo','예약 완료 · 해제'],
  scheduledStatus:['予約済み','Scheduled','예약 완료'],postedStatus:['投稿済み','Posted','게시 완료'],
  edit:['日英草案を編集','Edit JA / EN drafts','일·영 초안 편집'],save:['変更を保存','Save changes','변경 저장'],cancel:['キャンセル','Cancel','취소'],
  editWarning:['本文を変更・再生成するとNOBO確認と画像プロンプトをリセットします。予約済みの本文は先に予約解除してください。','Editing or regenerating resets the NOBO check and image prompt. Undo scheduled status before changing text.','편집·재생성하면 NOBO 확인과 이미지 프롬프트가 초기화됩니다. 본문 변경 전 예약을 해제하세요.'],
  regenerate:['本文を再生成','Regenerate text','본문 재생성'],instructions:['修正したい点（任意）','What to change (optional)','수정할 내용 (선택)'],
  missing:['このSNSの草案は未作成です。日付を開くと自動作成します。','This channel has no draft yet. It will be created when opened.','이 SNS의 초안은 아직 없습니다. 날짜를 열면 자동 생성합니다.'],
  supplied:['10月の提供原稿 · X','Supplied October draft · X','제공된 10월 원고 · X'],noboApplied:['NOBO修正文を反映','NOBO wording applied','NOBO 수정문 반영'],
  saved:['共有保存しました','Saved for the team','공유 저장 완료'],unavailable:['共有サーバーに接続できません。Workerの更新・ログイン状態を確認して再接続してください。','Cannot reach the shared server. Check the Worker and sign-in state, then refresh.','공유 서버에 연결하지 못했습니다. Worker와 로그인 상태를 확인한 뒤 새로고침하세요.'],
  error:['保存できませんでした。入力は残しています。','Could not save. Your input is preserved.','저장하지 못했습니다. 입력은 유지됩니다.'],conflict:['別の端末で変更されました。入力を控え、キャンセルして更新後にやり直してください。','Changed on another device. Keep your edits, cancel and refresh before retrying.','다른 기기에서 변경되었습니다. 입력을 복사한 뒤 취소·새로고침 후 다시 시도하세요.'],
  remote:['別の端末で更新がありました。編集中の内容は保持しています。','Updated elsewhere. Your edits are preserved.','다른 기기에서 변경했습니다. 편집 내용은 유지됩니다.'],
  role:['NOBOの担当アカウントでログインしてください。','Sign in with the assigned NOBO account.','NOBO 담당 계정으로 로그인하세요.'],briefError:['投稿方針を10文字以上で入力してください。','Enter a writing brief of at least 10 characters.','작성 지침을 10자 이상 입력하세요.'],
  genError:['AI応答の取得または検証に失敗しました。既存の文章は変更していません。「もう一度読み込む」か再生成で再試行できます。','Could not retrieve or validate AI output. Existing text is preserved. Retry loading or regenerate.','AI 응답을 가져오거나 검증하지 못했습니다. 기존 본문은 유지됩니다. 다시 불러오거나 재생성하세요.'],
  busy:['他の生成処理が進行中です。少し待って再試行してください。','Another generation is running. Wait briefly and retry.','다른 생성이 진행 중입니다. 잠시 후 다시 시도하세요.'],already:['本文を変更する前に予約を解除してください。','Undo scheduled status before changing the text.','본문 변경 전에 예약을 해제하세요.'],notReady:['NOBO確認完了または投稿日前日までお待ちください。','Wait for NOBO or the day before posting.','NOBO 확인 완료 또는 게시 전날까지 기다리세요.'],overlap:['テーマ・切り口・本文が履歴と重複しています。再試行してください。','Theme, angle or text overlaps history. Please retry.','주제·관점·본문이 기록과 중복됩니다. 다시 시도하세요.'],
  copyError:['コピーできませんでした。英語本文を選択してコピーしてください。','Copy failed. Select and copy the English text manually.','복사하지 못했습니다. 영어 본문을 선택해 복사하세요.'],unsaved:['編集中です。保存またはキャンセルしてください。','Save or cancel your edits first.','편집 내용을 저장하거나 취소하세요.'],
  next:['次の日付へ','Next dates','다음 날짜로'],previous:['前の週','Previous week','이전 주'],empty:['草案はまだありません','No drafts yet','아직 초안이 없습니다'],
};

export function createEditor(a) {
  const t=k=>labels[k][({ja:0,en:1,ko:2})[a.lang()] ?? 0], e=a.esc;
  let weeks=[],externalReviews=[],holidays={},loaded=false,online=false,loading=false,attempted=false,busy=false,ai=false,noticeText='',edit='',editMode='',buffer={},settingsDirty=false,lastSync=0;
  let date=R.today()<'2026-10-27'?'2026-10-27':R.today(),first=date,last=R.addDays(R.monday(date),6),pf='X',brief='',observer=null,failedKey='',pendingRemote=false,instructions={};
  const initial=a.selection?.();if(initial){if(R.dateOK(initial.date))date=initial.date;if(['X','IG','IGS'].includes(initial.platform))pf=initial.platform;first=date;last=R.addDays(R.monday(date),6);}
  if(date>R.EDITOR_END_DATE){date=R.EDITOR_END_DATE;first=date;last=date;}
  let stories=null,storyLoading=false,storyError=false,lastStory={},resetArmed='',cancelArmed='',calendarOffset=0;
  async function loadStories(){
    if(storyLoading)return;storyLoading=true;
    try{let list=a.stories?.();if(!Array.isArray(list)){const r=await fetch('./posts.json');if(!r.ok)throw Error();const j=await r.json();list=(j.channels.find(c=>c.id==='reel')||{}).snippets||[];}
      stories=list.map(sn=>({...sn,items:(sn.items||[]).filter(s=>typeof s==='string'&&s.trim()&&s.length<=Math.min(sn.max||25,25))}));storyError=false;
    }catch{stories=[];storyError=true;}finally{storyLoading=false;if(a.active()&&pf==='IGS')render();}
  }
  function storyHTML(){
    if(stories===null){loadStories();return `<p>${e(t('loading'))}</p>`;}
    if(storyError||!stories.length)return `<p>${e(t(storyError?'storyError':'storyEmpty'))}</p>`;
    return stories.map((sn,i)=>`<section class="re-day re-story"><span class="re-eyebrow">IG Story</span><h3>${e(sn.title)}</h3>${sn.url?`<div class="re-toolbar re-story-link"><button data-re-action="storyUrl" data-story="${i}">${e(t('storyUrl'))}</button></div>`:''}<div class="re-toolbar re-story-random"><button class="re-primary" data-re-action="storyRandom" data-story="${i}" ${sn.items.length?'':'disabled'}>${e(t('storyRandom'))}</button></div><p data-story-result="${i}" role="status" aria-live="polite">${e(lastStory[i]||'')}</p><details><summary>${e(t('storyChoices'))}</summary><div class="re-story-choices">${sn.items.map((s,j)=>`<button data-re-action="storyItem" data-story="${i}" data-item="${j}">${e(s)}</button>`).join('')}</div></details></section>`).join('');
  }
  const member=()=>!!(a.user() && (a.user().member || a.user().admin));
  const canConfirm=()=>member()&&!!(a.user()?.admin||String(a.user()?.id||'').trim().toLowerCase()==='nobo');
  const find=day=>{const w=weeks.find(w=>w.start===R.monday(day));return {w,d:w?.days.find(d=>d.date===day)};};
  const ready=d=>!!d && R.ready({...d.posts[pf],date:d.date});
  const key=day=>day+'|'+pf;
  const draftKey=(day,mode,partIndex=buffer.partIndex)=>'remitech-editor-draft-v1|'+(a.user()?.id||'')+'|'+key(day)+'|'+mode+(mode==='nobo'||mode.startsWith('inline-')?'|'+(partIndex??0):'');
  function readDraft(day,mode,partIndex){try{const s=localStorage.getItem(draftKey(day,mode,partIndex));const d=s&&JSON.parse(s);return d&&typeof d.en==='string'&&typeof d.ja==='string'?d:null;}catch{return null;}}
  function stash(){
    if(!edit)return true;
    try{localStorage.setItem(draftKey(edit,editMode),JSON.stringify({...buffer,savedAt:new Date().toISOString()}));const el=a.view.querySelector('[data-re-draft-status]');if(el)el.textContent=t('localDraft');return true;}
    catch{const el=a.view.querySelector('[data-re-draft-status]');if(el)el.textContent=t('localError');notice(t('localError'),true);return false;}
  }
  function notice(s,alert=false){noticeText=s;const el=a.view.querySelector('[data-re-notice]');if(el){el.textContent=s;el.hidden=!s;el.setAttribute('role',alert?'alert':'status');}}
  const copyStates=new WeakMap();
  function copiedFeedback(button){
    let state=copyStates.get(button);
    if(state)clearTimeout(state.timer);
    else{
      const rect=button.getBoundingClientRect();
      state={text:button.textContent,width:button.style.width,height:button.style.height,boxSizing:button.style.boxSizing};
      button.style.boxSizing='border-box';button.style.width=rect.width+'px';button.style.height=rect.height+'px';
    }
    button.dataset.copied='true';button.textContent=t(button.closest('.re-field-actions')?'copiedShort':'copied');button.setAttribute('aria-live','polite');
    state.timer=setTimeout(()=>{button.textContent=state.text;delete button.dataset.copied;button.style.width=state.width;button.style.height=state.height;button.style.boxSizing=state.boxSizing;copyStates.delete(button);},1800);
    copyStates.set(button,state);
  }
  const errorText=code=>t(({conflict:'conflict','member-required':'login',reviewer:'role','reviewer-required':'reviewerOnly',brief:'briefError','ai-unavailable':'aiOff','generation-failed':'genError','ai-busy':'busy','already-booked':'already','not-ready':'notReady','theme-overlap':'overlap','duplicate-text':'overlap','angle-reused':'overlap'})[code]||'error');
  async function call(body){
    if(a.preview){if(body)throw Error('preview');return structuredClone(a.preview);}
    const r=await fetch(a.api(),{method:body?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json',...a.headers()},body:body?JSON.stringify(body):undefined});
    const j=await r.json();if(!r.ok)throw Error(j.error||'network');if(!body && !Array.isArray(j.weeks))throw Error('server-update-required');
    if(body && (!j.ok || (body.op==='generate'?!Array.isArray(j.weeks):body.op==='settings'?!j.settings:body.op==='holiday'?!j.holidays:!j.week)))throw Error('network');
    return j;
  }
  async function load(force=false){
    if(loading||busy)return;
    if(edit||settingsDirty){pendingRemote=true;return;}
    loading=true;attempted=true;let changed=!loaded;
    try{const wasOffline=!online;const j=await call();if(edit||settingsDirty||busy){pendingRemote=true;notice(t('remote'));return;}changed=changed||JSON.stringify(j.weeks)!==JSON.stringify(weeks)||JSON.stringify(j.externalReviews||[])!==JSON.stringify(externalReviews)||JSON.stringify(j.holidays||{})!==JSON.stringify(holidays)||j.ai!==ai||!online;weeks=j.weeks;externalReviews=j.externalReviews||[];holidays=j.holidays||{};brief=j.settings.brief;ai=j.ai;online=true;loaded=true;lastSync=Date.now();pendingRemote=false;if(force||wasOffline)noticeText='';}
    catch(error){
      online=false;ai=false;
      // Drafts are served only by the authenticated Worker, never public assets.
      noticeText=pf==='IGS'?'':t(error.message==='server-update-required'?'serverPending':'unavailable');
    }finally{loading=false;if(a.active()&&!edit&&!busy&&!settingsDirty){if(changed||force||!online)render();ensure(date);}}
  }
  function autoRefresh(){
    if(!a.active()||a.preview||document.hidden)return;
    if(edit||busy||settingsDirty){pendingRemote=true;return;}
    if(Date.now()-lastSync<5000)return;
    load();
  }
  function canLeave(){if(edit||busy||settingsDirty){notice(t('unsaved'));return false;}return true;}
  function scrollToDay(day){requestAnimationFrame(()=>a.view.querySelector(`[data-re-day="${day}"]`)?.scrollIntoView({block:'start'}));}
  async function open(day){
    if(!R.dateOK(day)||!canLeave())return;if(day>R.EDITOR_END_DATE){notice(t('scope'));return;}
    date=day;first=day;last=R.addDays(R.monday(day),6);failedKey='';a.navigate?.(date,pf);render();scrollToDay(day);await ensure(day);autoRefresh();
  }
  async function ensure(day) { /* Drafts are supplied by the author; never generate text on navigation. */ }
  function authorParts(day,p){return p?.parts?.map(part=>({...part}))||R.partLabels(day,pf).map((label,i)=>({label,ja:i===0?p?.ja||'':'',en:i===0?p?.en||'':''}));}
  const nonNoboReview=review=>!!review&&String(review.by||'').trim().toLowerCase()!=='nobo';
  function dateLabel(day){
    const weekday=new Intl.DateTimeFormat(a.lang(),{weekday:'short',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'));
    return day+' ('+weekday+')';
  }
  function postHTML(d,w){
    const p=d.posts[pf],editing=edit===d.date,booked=a.booked(d.date,pf),posted=!!a.posted?.(d.date,pf),can=ready(d),disabled=busy||!online||!member();
    const otherConfirmation=R.fullyReviewed(p)&&R.partReviews(p).some(nonNoboReview);
    const button=(action,text,disabled=false,extra='')=>`<button data-re-action="${action}" ${disabled?'disabled':''} ${extra}>${e(text)}</button>`;
    const pair=(ja,en,suffix='',partIndex=null)=>{
      const copy=partIndex===null?R.english(p):R.englishPart(p,partIndex);
      const index=partIndex??0,review=R.partReviews(p)[index],revised=copy!==en;
      const adminButton=nonNoboReview(review);
      const extra=`data-part="${index}"`;
      const activeInline=editing&&buffer.partIndex===index;
      const editorField=(language,value)=>{
        if(activeInline&&editMode==='inline-'+language)return `<textarea data-re-inline maxlength="${language==='ja'?6000:pf==='X'?240:500}" aria-label="${language==='ja'?'日本語':'English'}">${e(buffer.text)}</textarea><p data-re-draft-status role="status">${e(t('localDraft'))}</p><div class="re-edit-footer">${button('noboReset',t('resetShort'),busy)}<div class="re-toolbar">${button('save',t('save'),busy,'class="re-primary"')}${button('cancel',t('cancel'),busy)}</div></div>`;
        const display=language==='en'?R.formatEnglishPost(value,d.date,pf):value;
        return `<button class="re-inline-text re-text" data-re-action="inline${language==='ja'?'Ja':'En'}" ${extra} ${disabled||editing||booked||review?'disabled':''} aria-label="${language==='ja'?'日本語':'English'} · ${e(t('clickEdit'))}">${e(display)}</button>`;
      };
      return `<div class="re-drafts" data-confirmed="${!!review}"><div><label for="re-ja-${d.date}${suffix}">日本語 · JA</label>${editorField('ja',ja)}</div><section class="re-nobo-field"><div class="re-field-header"><span class="re-field-label">${e(t(revised?'revisedEnglish':'draftEnglish'))}</span><div class="re-field-actions">${button(partIndex===null?'copy':'copyPart',t('copy'),!can||editing||busy,extra)}${button('confirmPart',t(review?(adminButton&&review.admin?'adminUndoConfirm':'undoConfirm'):'confirm'),disabled||editing||!canConfirm(),`${extra} data-admin-confirm="${adminButton}" aria-pressed="${!!review}"`)}</div></div>${editorField('en',copy)}</section></div>`;
    };
    let content='';
    if(editing && editMode==='nobo'){
      const fields=p.parts?.length?p.parts.map((part,i)=>buffer.partIndex!==undefined&&buffer.partIndex!==i?'':`<label for="re-nobo-${i}">${e(part.label)}</label><textarea id="re-nobo-${i}" data-re-nobo="${i}" maxlength="6000">${e(buffer.parts[i])}</textarea>`).join(''):`<label for="re-nobo-en">ENGLISH · NOBO</label><textarea id="re-nobo-en" data-re-nobo-en maxlength="6000">${e(buffer.en)}</textarea>`;
      content=`<dialog class="re-nobo-dialog"><h3>${e(t('noboEdit'))} · ${e(dateLabel(d.date))} · ${pf}</h3><p class="re-text">${e(p.parts?.[buffer.partIndex]?.ja||p.ja)}</p><details><summary>${e(t('original'))}</summary><div class="re-text">${e(p.parts?.[buffer.partIndex]?.en||p.en)}</div></details><div class="re-nobo">${fields}</div><p data-re-draft-status role="status" aria-live="polite">${e(buffer.revision!==w.revision?t('conflict'):t('localDraft'))}</p><div class="re-toolbar">${buffer.revision!==w.revision?button('latest',t('useLatest'),busy):''}${button('save',t('shareSave'),busy,'class="re-primary"')}${button('localClose',t('localClose'),busy)}${button('cancel',t('cancel'),busy)}${button('noboReset',t('noboReset'),busy)}</div><small>${e(t('resetHelp'))}</small></dialog>`;
    }else if(editing&&editMode==='author'){
      const fields=buffer.authorParts.map((part,i)=>`<section class="re-part"><strong>${e(part.label)}</strong><div class="re-drafts"><div><label for="re-author-ja-${i}">日本語 · JA</label><textarea id="re-author-ja-${i}" data-author-ja="${i}" maxlength="6000">${e(part.ja)}</textarea></div><div><label for="re-author-en-${i}">ENGLISH · EN</label><textarea id="re-author-en-${i}" data-author-en="${i}" maxlength="${pf==='X'?240:500}">${e(part.en)}</textarea></div></div></section>`).join('');
      content=`${!w?`<label>${e(t('theme'))}<input data-re-theme value="${e(buffer.theme||'')}" maxlength="120"></label><label>${e(t('arc'))}<input data-re-arc value="${e(buffer.arc||'')}" maxlength="600"></label>`:''}${fields}<p>${e(t('editWarning'))}</p><div class="re-toolbar">${button('save',t('save'),busy,'class="re-primary"')}${button('cancel',t('cancel'),busy)}</div>`;
    }else if(!p){
      content=`<p>${e(t('manualMissing'))}</p>${button('newDraft',t('addDraft'),disabled)}`;
    }else{
      content=p.parts?.length?p.parts.map((part,i)=>`<section class="re-part"><div class="re-toolbar"><strong>${e(part.label)}</strong>${part.nobo?`<small>${e(t('noboApplied'))}</small>`:''}</div>${pair(part.ja,part.en,'-'+i,i)}</section>`).join(''):pair(p.ja,p.en);

    }
    return `<article class="re-day" data-re-day="${d.date}"><header class="re-dayhead"><div><span class="re-eyebrow">${e(dateLabel(d.date))} · ${pf}</span><h3>${e(d.focus)}</h3>${p?.source?`<small>${e(t('supplied'))}</small>`:''}</div><div class="re-day-statuses">${posted||booked?`<span class="re-publication" data-state="${posted?'posted':'scheduled'}">✓ ${e(t(posted?'postedStatus':'scheduledStatus'))}</span>`:''}<span class="re-status" data-ready="${R.fullyReviewed(p)}">${e(R.fullyReviewed(p)?t('allConfirmed'):p?t('confirmedProgress').replace('{count}',R.partReviews(p).filter(Boolean).length).replace('{total}',R.partReviews(p).length):t('pending'))}</span></div></header>${content}

      <div class="re-actions">${p?button('confirmDay',(otherConfirmation&&p.secondReview?.admin)?pf+' · '+t('adminUndoConfirm'):t(R.fullyReviewed(p)?'unconfirmDay':'confirmDay').replace('{sns}',pf),disabled||editing||!canConfirm(),`data-admin-confirm="${otherConfirmation}" aria-pressed="${R.fullyReviewed(p)}"`):''}${button('copyFeeds',t('copyFeeds'),!can||editing||busy,'class="re-primary"')}
      ${button('book',(booked?'✓ ':'')+pf+' · '+t(booked?'booked':'book'),disabled||editing||(!can&&!booked),`class="re-book-button" data-booked="${booked}" aria-pressed="${booked}"`)}
      </div></article>${d.date===R.EDITOR_END_DATE?`<div class="re-weekend-end">${e(t('wellDone'))}</div>`:''}`;
  }
  function checkOverview(){
    const today=R.today(),start=R.addDays(today,calendarOffset*7),dates=Array.from({length:14},(_,i)=>R.addDays(start,i));
    const statuses=[['empty',t('noDraft'),'—'],['pending',t('pending'),'·'],['checked',t('checked'),'✓'],['scheduled',t('scheduledStatus'),'✓'],['posted',t('postedStatus'),'✓']];
    const weekdays=({ja:['日','月','火','水','木','金','土'],en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],ko:['일','월','화','수','목','금','토']})[a.lang()]||['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const head=`<span class="re-check-corner">SNS</span>${dates.map(day=>{const weekday=new Date(day+'T00:00:00Z').getUTCDay(),national=R.koreanHoliday(day,a.lang()),holiday=!!(national||holidays[day]),description=national?t('koreanHoliday')+national:holidays[day]?t('holidayUnset'):weekday===0?t('sunday')+' · '+t('holidaySet'):t('holidaySet');return `<button class="re-check-date" data-re-holiday="${day}" data-weekday="${weekday}" data-holiday="${holiday}" ${day===today?'data-today="true"':''} title="${e(description)}" aria-label="${day} · ${e(description)}" aria-pressed="${holiday}" ${busy||!member()||!online?'disabled':''}><span>${day.slice(5).replace('-','/')}</span><small>${e(weekdays[weekday])}</small></button>`;}).join('')}`;
    const rows=['X','IG'].map(channel=>`<strong class="re-check-channel">${channel}</strong>${dates.map(day=>{
      const post=find(day).d?.posts[channel];
      const external=!post&&externalReviews.some(r=>r.date===day&&r.platform===channel);
      const status=external?statuses[2]:!post?statuses[0]:!R.fullyReviewed(post)?statuses[1]:statuses[2];
      const posted=!!a.posted?.(day,channel),booked=a.booked(day,channel),publication=posted?'posted':booked?'scheduled':'';
      const publicationLabel=publication?t(posted?'postedStatus':'scheduledStatus'):'';
      const name=`${day} · ${channel} · ${external?t('externalReview'):status[1]}${publication?' · '+publicationLabel:''}`;
      return `<div class="re-check-cell"><button class="re-check-circle" data-re-check-date="${day}" data-re-check-platform="${channel}" data-external-review="${external}" data-status="${status[0]}" data-publication="${publication}" aria-label="${e(name)}" title="${e(name)}" aria-pressed="${day===date&&pf===channel}" ${busy||day>R.EDITOR_END_DATE?'disabled':''}>${status[2]}</button>${publication?`<span class="re-calendar-publication" data-state="${publication}">${e(publicationLabel)}</span>`:''}</div>`;
    }).join('')}`).join('');
    return `<section class="re-check-overview" aria-label="${e(t('checkOverview'))}"><header class="re-check-header"><div><strong class="re-check-title">${e(t('checkOverview'))}</strong><small class="re-check-range">${dates[0]} — ${dates[13]}</small></div><div class="re-toolbar"><button data-re-action="calendarPrevious" aria-label="${e(t('calendarPrev'))}" title="${e(t('calendarPrev'))}" ${busy?'disabled':''}>←</button><button data-re-action="calendarNext" aria-label="${e(t('calendarNext'))}" title="${e(t('calendarNext'))}" ${busy?'disabled':''}>→</button></div></header><div class="re-check-scroll" tabindex="0" role="region" aria-label="${e(t('checkOverview'))}"><div class="re-check-grid">${head}${rows}</div></div><div class="re-check-legend">${statuses.map(([state,label,symbol])=>`<span><i data-status="${state}" aria-hidden="true">${symbol}</i>${e(label)}</span>`).join('')}</div></section>`;
  }
  function render(){
    if(!a.active())return;observer?.disconnect();
    const days=[];for(let day=first;day<=last;day=R.addDays(day,1))days.push(day);
    const current=find(date).w;
    a.view.innerHTML=`<section class="reel-editor"><header class="re-top"><div><h2>${e(t('title'))}</h2></div></header>
      <div class="re-date-controls"><div class="re-toolbar re-datebar"><label for="re-date">${e(t('date'))}</label><input type="date" id="re-date" value="${date}" max="${R.EDITOR_END_DATE}" ${busy?'disabled':''}><div class="re-toolbar" role="group" aria-label="SNS">${['X','IG','IGS'].map(p=>`<button data-re-platform="${p}" aria-pressed="${pf===p}" ${busy?'disabled':''}>${p==='IGS'?'IG Story':p}</button>`).join('')}</div><button data-re-action="previous" ${busy?'disabled':''}>← ${e(t('previous'))}</button></div>
      ${checkOverview()}</div>
      <div data-re-notice class="re-notice" aria-live="polite" role="status" ${noticeText?'':'hidden'}>${e(noticeText)}</div>
      ${a.preview?'<div class="re-notice">デザイン確認用のサンプルです。日付・X／IG／IG Storyの切り替えを試せます。実際の投稿や会員情報は含まず、編集・保存はできません。</div>':!member()?`<div class="re-notice">${e(t('login'))} <button data-re-action="login">${e(t('loginBtn'))}</button></div>`:!online&&attempted?'<p><a href="./posts-compare.html">デザイン比較を見る ↗</a></p>':''}
      <details class="re-plan"><summary>${e(t('settings'))}</summary><label for="re-brief">${e(t('brief'))}</label><textarea id="re-brief" maxlength="3000">${e(brief)}</textarea><button data-re-action="settings" ${busy||!member()||!online?'disabled':''}>${e(t('saveBrief'))}</button><button data-re-action="cancelSettings" ${busy?'disabled':''}>${e(t('cancel'))}</button></details>
      ${weeks.length?`<nav class="re-weeks" aria-label="4 weeks">${weeks.filter(w=>w.start>=R.monday(first)&&w.start<=R.EDITOR_END_DATE).slice(0,4).map(w=>`<button data-re-open="${w.start}" aria-pressed="${R.monday(date)===w.start}" ${busy?'disabled':''}><small>${w.start} — ${R.addDays(w.start,6)}</small><b>${e(w.theme)}</b><small>${e(w.angle)}</small></button>`).join('')}</nav>`:''}
      ${current?`<div class="re-week"><span class="re-eyebrow">${current.start} — ${R.addDays(current.start,6)}</span><h3>${e(current.theme)}</h3><p>${e(current.arc)}</p></div>`:''}
      ${pf==='IGS'?storyHTML():!loaded?`<p>${e(t(loading?'loading':'manualMissing'))}</p>`:days.map(day=>{const {w,d}=find(day);return postHTML(d||{date:day,focus:w?.theme||t('empty'),posts:{}},w);}).join('')}
      <div class="re-more"><button data-re-action="more" ${busy?'disabled':''}>${e(t('next'))} ↓</button></div></section>`;
    if(pf==='IGS')a.view.querySelectorAll('.re-weeks,.re-week,.re-plan,.re-more').forEach(el=>el.hidden=true);
    if(last>=R.EDITOR_END_DATE)a.view.querySelector('.re-more').hidden=true;
    a.view.querySelectorAll('.re-plan').forEach(el=>el.hidden=true);
    a.view.querySelector('.re-nobo-dialog')?.showModal();observe();if(pf!=='IGS'&&!loaded&&!loading&&!attempted)load();
  }
  function observe(){
    observer=new IntersectionObserver(entries=>{
      if(busy||edit||!a.active())return;
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        if(entry.target.classList.contains('re-more')){
          // Only extend once the reader reaches the bottom, not during initial layout.
          if(window.scrollY>100 && !edit && !settingsDirty && last<R.EDITOR_END_DATE){last=R.addDays(last,7)>R.EDITOR_END_DATE?R.EDITOR_END_DATE:R.addDays(last,7);const y=window.scrollY;render();window.scrollTo(0,y);}return;
        }
      }
      const controlsBottom=Math.max(12,(a.view.querySelector('.re-date-controls')?.getBoundingClientRect().bottom||0)+12);
      const reading=[...a.view.querySelectorAll('[data-re-day]')].find(el=>{const r=el.getBoundingClientRect();return r.bottom>controlsBottom&&r.top<window.innerHeight;});
      if(reading){const day=reading.dataset.reDay,input=a.view.querySelector('#re-date');if(input)input.value=day;date=day;a.view.querySelectorAll('[data-re-check-date]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.reCheckDate===date&&el.dataset.reCheckPlatform===pf)));a.navigate?.(date,pf);ensure(day);}
    },{threshold:[0,0.12,0.5]});
    a.view.querySelectorAll('[data-re-day],.re-more').forEach(el=>observer.observe(el));
  }
  async function mutate(body,success='saved',automatic=false){
    if(edit && !['draft','edit','nobo-edit','nobo-reset','edit-japanese'].includes(body.op)){notice(t('unsaved'));return null;}
    busy=true;const y=window.scrollY;
    a.view.querySelectorAll('[data-re-action],[data-re-platform],[data-re-check-date],[data-re-holiday],#re-date').forEach(el=>el.disabled=true);
    try{
      const j=await call(body);
      if(j.weeks)weeks=j.weeks;
      if(j.week){if(weeks.some(w=>w.start===j.week.start))weeks=weeks.map(w=>w.start===j.week.start?j.week:w);else{weeks.push(j.week);weeks.sort((a,b)=>a.start.localeCompare(b.start));}}
      if(j.holidays)holidays=j.holidays;
      if(j.settings){brief=j.settings.brief;settingsDirty=false;}
      if(edit && ['draft','edit','nobo-edit','nobo-reset','edit-japanese'].includes(body.op)){try{localStorage.removeItem(draftKey(edit,editMode));}catch{}}
      edit='';buffer={};noticeText=automatic?'':t(success);pendingRemote=false;
      if(body.op==='book'||body.op==='holiday')await a.pullBookings();
      busy=false;render();window.scrollTo(0,y);return j;
    }catch(error){
      busy=false;
      if(!edit)render();else a.view.querySelectorAll('[data-re-action="save"],[data-re-action="cancel"],[data-re-action="localClose"],[data-re-action="refresh"],[data-re-action="noboReset"]').forEach(el=>el.disabled=false);
      notice(errorText(error.message),true);const status=a.view.querySelector('[data-re-draft-status]');if(status)status.textContent=errorText(error.message)+' '+t('localDraft');return null;
    }
  }
  a.view.addEventListener('input',ev=>{
    cancelArmed='';const cancel=a.view.querySelector('[data-re-action="cancel"]');if(cancel)cancel.textContent=t('cancel');
    resetArmed='';const reset=a.view.querySelector('[data-re-action="noboReset"]');if(reset)reset.textContent=t(editMode.startsWith('inline-')?'resetShort':'noboReset');
    if(ev.target.id==='re-brief'){brief=ev.target.value;settingsDirty=true;}
    if(ev.target.matches('[data-re-inline]'))buffer.text=ev.target.value;
    if(ev.target.matches('[data-re-ja]'))buffer.ja=ev.target.value;
    if(ev.target.matches('[data-re-en]'))buffer.en=ev.target.value;
    if(ev.target.matches('[data-re-nobo-en]'))buffer.en=ev.target.value;
    if(ev.target.matches('[data-re-nobo]'))buffer.parts[Number(ev.target.dataset.reNobo)]=ev.target.value;
    if(ev.target.matches('[data-re-theme]'))buffer.theme=ev.target.value;
    if(ev.target.matches('[data-re-arc]'))buffer.arc=ev.target.value;
    if(ev.target.matches('[data-author-ja]'))buffer.authorParts[Number(ev.target.dataset.authorJa)].ja=ev.target.value;
    if(ev.target.matches('[data-author-en]'))buffer.authorParts[Number(ev.target.dataset.authorEn)].en=ev.target.value;
    if(ev.target.matches('[data-re-instructions]'))instructions[key(ev.target.closest('[data-re-day]').dataset.reDay)]=ev.target.value;
    if(edit && ev.target.matches('[data-re-inline],[data-re-ja],[data-re-en],[data-re-nobo],[data-re-nobo-en],[data-re-theme],[data-re-arc],[data-author-ja],[data-author-en]'))stash();
  });
  a.view.addEventListener('change',ev=>{if(ev.target.id==='re-date')open(ev.target.value);});
  a.view.addEventListener('cancel',ev=>{if(ev.target.matches('.re-nobo-dialog')){ev.preventDefault();if(!busy&&stash()){edit='';buffer={};render();}}},true);
  a.view.addEventListener('click',async ev=>{
    if(!a.active()||busy)return;const btn=ev.target.closest('button');if(!btn)return;
    if(btn.dataset.reHoliday){
      if(!member()||!online||!canLeave())return;
      const day=btn.dataset.reHoliday,national=R.koreanHoliday(day,a.lang());
      if(national){notice(t('koreanHoliday')+national);return;}
      await mutate({op:'holiday',date:day,holiday:!holidays[day]});return;
    }
    if(btn.dataset.reCheckDate){if(btn.dataset.externalReview==='true'){notice(t('externalReview'));return;}if(!canLeave())return;pf=btn.dataset.reCheckPlatform;await open(btn.dataset.reCheckDate);return;}
    if(btn.dataset.reOpen){await open(btn.dataset.reOpen);return;}
    if(btn.dataset.rePlatform){if(!canLeave())return;pf=btn.dataset.rePlatform;if(pf==='IGS')noticeText='';failedKey='';a.navigate?.(date,pf);render();await ensure(date);autoRefresh();return;}
    const op=btn.dataset.reAction;if(!op)return;
    if(op!=='cancel'){cancelArmed='';const cancel=a.view.querySelector('[data-re-action="cancel"]');if(cancel)cancel.textContent=t('cancel');}
    if(op!=='noboReset'){resetArmed='';const reset=a.view.querySelector('[data-re-action="noboReset"]');if(reset)reset.textContent=t(editMode.startsWith('inline-')?'resetShort':'noboReset');}
    if(['storyRandom','storyItem','storyUrl'].includes(op)){
      const i=Number(btn.dataset.story),sn=stories?.[i];if(!sn)return;
      const choices=sn.items.filter(s=>s!==lastStory[i]);
      const value=op==='storyUrl'?sn.url:op==='storyItem'?sn.items[Number(btn.dataset.item)]:(choices.length?choices:sn.items)[Math.floor(Math.random()*(choices.length||sn.items.length))];if(!value)return;
      try{await navigator.clipboard.writeText(value);if(op!=='storyUrl'){lastStory[i]=value;const result=a.view.querySelector(`[data-story-result="${i}"]`);if(result)result.textContent=value;}copiedFeedback(btn);}catch{notice(t('copyError'),true);}return;
    }
    if(op==='bookmark'){try{await navigator.clipboard.writeText(window.location.href);notice(t('bookmarkCopied'));}catch{notice(t('copyError'),true);}return;}
    if(op==='login'){a.login();return;}
    if(op==='cancelSettings'){settingsDirty=false;await load(true);return;}
    if(op==='refresh'){if(!canLeave())return;failedKey='';if(pf==='IGS'){stories=null;await loadStories();}else await load(true);return;}
    if(op==='calendarPrevious'||op==='calendarNext'){if(!canLeave())return;calendarOffset+=op==='calendarPrevious'?-1:1;const y=window.scrollY;render();window.scrollTo(0,y);autoRefresh();return;}
    if(op==='previous'){await open(R.addDays(first,-7));return;}
    if(op==='more'){if(!canLeave())return;last=R.addDays(last,7)>R.EDITOR_END_DATE?R.EDITOR_END_DATE:R.addDays(last,7);render();return;}
    if(op==='settings'){if(brief.trim().length<10){notice(t('briefError'),true);return;}await mutate({op:'settings',brief});await ensure(date);return;}
    const card=btn.closest('[data-re-day]');if(!card)return;const day=card.dataset.reDay,{w,d}=find(day),p=d?.posts[pf];
    if(op==='inlineJa'||op==='inlineEn'){
      if(!member()||!online||a.booked(day,pf)||!canLeave())return;
      const index=Number(btn.dataset.part||0),mode=op==='inlineJa'?'inline-ja':'inline-en';
      if(R.partReviews(p)[index])return;
      edit=day;editMode=mode;buffer=readDraft(day,mode,index)||{ja:p.ja,en:p.en,text:op==='inlineJa'?(p.parts?.[index]?.ja||p.ja):(p.parts?.length?R.englishPart(p,index):R.english(p)),revision:w.revision,partIndex:index};
      stash();render();a.view.querySelector('[data-re-inline]')?.focus();return;
    }
    if(op==='newDraft'){if(!canLeave())return;edit=day;editMode='author';buffer=readDraft(day,'author')||{ja:'',en:'',revision:w?.revision||0,theme:'',arc:''};buffer.authorParts=buffer.authorParts||authorParts(day);stash();render();return;}
    if(op==='edit'||op==='nobo'){if(!canLeave())return;edit=day;editMode=op==='nobo'?'nobo':'author';buffer=readDraft(day,editMode,Number(btn.dataset.part||0))||{ja:p.ja,en:op==='nobo'?R.english(p):p.en,parts:p.parts?.map((part,i)=>R.englishPart(p,i)),revision:w.revision};if(editMode==='nobo')buffer.partIndex=Number(btn.dataset.part||0);if(editMode==='author')buffer.authorParts=buffer.authorParts||authorParts(day,p);stash();render();a.view.querySelector('textarea[data-author-ja],.re-nobo textarea')?.focus();return;}
    if(op==='localClose'){if(stash()){edit='';buffer={};render();}return;}
    if(op==='latest'){buffer.revision=w.revision;stash();render();return;}
    if(op==='cancel'){
      if(cancelArmed!==day){cancelArmed=day;btn.textContent=t('cancelConfirm');return;}
      cancelArmed='';try{localStorage.removeItem(draftKey(edit,editMode));}catch{}
      edit='';buffer={};render();if(pendingRemote)load();return;
    }
    if(op==='copy'||op==='copyPart'||op==='copyFeeds'){
      if(!ready(d))return;const value=op==='copyFeeds'?R.copyPostText(p,d.date,pf):R.formatEnglishPost(op==='copyPart'?R.englishPart(p,Number(btn.dataset.part)):R.english(p),d.date,pf);
      try{await navigator.clipboard.writeText(value);copiedFeedback(btn);autoRefresh();}catch{notice(t('copyError'),true);}return;
    }
    if(!w&&op!=='save')return;
    const body={op,start:w?.start||R.monday(day),date:day,platform:pf,revision:w?.revision||0};
    if(op==='image'){
      const prompt=`Create a 4:5 editorial image for REEL's ${pf} post. Communicate the core idea with one clear visual metaphor, thoughtful composition and natural lighting. Keep it grounded in gaming and real player experience. Do not include visible text, logos, charts or invented product features. Post message: ${R.english(p)}`;
      try{await navigator.clipboard.writeText(prompt);notice(t('imageCopied'));}catch{notice(t('copyError'),true);}return;
    }
    if(op==='save'&&editMode.startsWith('inline-')){
      stash();body.revision=buffer.revision;body.partIndex=buffer.partIndex;
      if(editMode==='inline-ja'){body.op='edit-japanese';body.text=buffer.text;}
      else{body.op='nobo-edit';body.parts=p.parts?.map((part,i)=>i===buffer.partIndex?buffer.text:R.englishPart(p,i));body.en=body.parts?body.parts.join('\n\n'):buffer.text;}
      await mutate(body);return;
    }
    if(op==='save'){stash();body.op=editMode==='nobo'?'nobo-edit':p?'edit':'draft';body.theme=buffer.theme;body.arc=buffer.arc;body.revision=buffer.revision??w?.revision??0;body.ja=buffer.ja;body.en=buffer.parts&&editMode==='nobo'?buffer.parts.join('\n\n'):buffer.en;if(editMode==='nobo'){body.partIndex=buffer.partIndex??0;if(buffer.parts)body.parts=buffer.parts;}if(editMode==='author'){body.parts=buffer.authorParts;body.ja=body.parts.map(p=>p.ja).join('\n\n');body.en=body.parts.map(p=>p.en).join('\n\n');}}
    if(op==='noboReset'){
      if(!['nobo','inline-en','inline-ja'].includes(editMode)||edit!==day)return;
      if(resetArmed!==day){resetArmed=day;btn.textContent=t('resetConfirm');return;}
      if(editMode==='inline-ja'){resetArmed='';buffer.text=p.parts?.[buffer.partIndex]?.ja||p.ja;stash();render();a.view.querySelector('[data-re-inline]')?.focus();return;}
      resetArmed='';body.op='nobo-reset';body.partIndex=buffer.partIndex??0;body.revision=buffer.revision??w.revision;
    }
    if(['confirmDay','confirmPart','review2'].includes(op)&&!canConfirm()){notice(t('reviewerOnly'),true);return;}
    if(op==='confirmDay')body.op='review2';
    if(op==='confirmPart'){body.op='confirm-part';body.partIndex=Number(btn.dataset.part);}
    if(op==='book')body.scheduled=!a.booked(day,pf);
    if(op==='regenerate')body.instructions=card.querySelector('[data-re-instructions]').value;
    if(['save','review2','book','regenerate','noboReset','confirmPart','confirmDay'].includes(op))await mutate(body);
  });
  window.addEventListener('focus',autoRefresh);
  window.addEventListener('online',()=>{lastSync=0;autoRefresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoRefresh();});
  window.addEventListener('beforeunload',ev=>{if(edit||busy||settingsDirty){ev.preventDefault();ev.returnValue='';}});
  // Refresh availability at the Seoul date boundary without losing edits.
  let calendar=R.today();setInterval(()=>{if(R.today()!==calendar){calendar=R.today();if(!edit&&!busy&&!settingsDirty)render();}},30000);
  return{render,load,canLeave,renderLocation:()=>{const s=a.selection?.();if(s&&R.dateOK(s.date)&&(s.date!==date||s.platform!==pf)){if(canLeave()){if(['X','IG','IGS'].includes(s.platform))pf=s.platform;open(s.date);}return;}render();},lock:()=>{observer?.disconnect();weeks=[];externalReviews=[];holidays={};loaded=false;online=false;edit='';buffer={};settingsDirty=false;},refresh:()=>{if(a.active())load();},authChanged:()=>{if(a.active()&&!edit){render();ensure(date);}}};
}
