const API='https://pokeapi.co/api/v2';
const hintDefinitions=[['generation','初登場世代'],['bst','合計種族値'],['type','タイプ'],['ability','特性'],['height','高さ'],['weight','重さ'],['gender','性別比'],['evolution','進化の段階'],['egg','タマゴグループ'],['category','分類'],['pokedex','図鑑説明'],['silhouette','シルエット']];
const $=id=>document.getElementById(id);
let current=null,token=0,solved=false;
const cache=new Map();
async function getJson(url){if(cache.has(url))return cache.get(url);const r=await fetch(url);if(!r.ok)throw Error('API通信エラー: '+r.status);const data=await r.json();cache.set(url,data);return data}
function ja(names,fallback){return names?.find(n=>n.language.name==='ja-Hrkt')?.name||names?.find(n=>n.language.name==='ja')?.name||fallback}
function speciesFromChain(chain,id,depth=0){if(Number(chain.species.url.match(/\/(\d+)\/$/)[1])===id)return depth;for(const child of chain.evolves_to){const found=speciesFromChain(child,id,depth+1);if(found!==null)return found}return null}
function evolutionPosition(chain,id){
 function walk(node,depth){
  if(speciesId(node.species.url)===id)return {node,depth};
  for(const child of node.evolves_to){const hit=walk(child,depth+1);if(hit)return hit}
  return null;
 }
 function longest(node){return node.evolves_to.length?1+Math.max(...node.evolves_to.map(longest)):0}
 const found=walk(chain,0);
 if(!found)return {stage:0,total:1};
 // 現在の枝に沿って、先に何段階進化できるかを計算する。
 return {stage:found.depth,total:found.depth+longest(found.node)+1};
}
function evolutionHint(pos){
 const {stage,total}=pos;
 if(total===1)return {stage:0,total:1,comment:'進化しないポケモン'};
 if(total===2)return {...pos,comment:stage===0?'1回進化するポケモンの最初の姿':'1回進化した最終進化の姿'};
 return {...pos,comment:stage===0?'2回進化するポケモンの最初の姿':stage===1?'2進化系の真ん中（1進化）':'2回進化した最終進化の姿'};
}
// pokemon-species の日本語分類・図鑑テキストをヒントに利用する。
function japaneseSpeciesText(s,baseName,displayName){
 const category=s.genera?.find(x=>x.language.name==='ja')?.genus||'データなし';
 const entries=(s.flavor_text_entries||[]).filter(x=>x.language.name==='ja');
 // 作品ごとに複数の説明があるため、問題ごとにひとつ選ぶ。
 const entry=entries.length?entries[Math.floor(Math.random()*entries.length)]:null;
 let description=entry?.flavor_text?.replace(/[\n\r\f\t]+/g,' ').replace(/\s+/g,' ').trim()||'日本語の図鑑説明は未収録です';
 // 答えの名前が説明に含まれる場合は隠す。通常名も特殊フォルム名も対象。
 const hiddenNames=[displayName,baseName,s.name].filter(Boolean);
 for(const name of hiddenNames.sort((a,b)=>b.length-a.length)){
  description=description.replaceAll(name,'？？？');
 }
 return {category,pokedex:description};
}
function sprite(p){return p.sprites.other?.['official-artwork']?.front_default||p.sprites.front_default}
function displayHints(p,s,abilities,types,eggGroups,gender,evolution,work){const gen=works.find(w=>w[0]===work)?.[2]||s.generation.name;return {generation:(jaGeneration(gen).split('（')[0]) + (work ? `（${workLabels[work]}）` : ''),bst:String(p.stats.reduce((sum,x)=>sum+x.base_stat,0)),type:types.join('・'),ability:abilities.join(' / ')||'未収録',height:(p.height/10)+'m',weight:(p.weight/10)+'kg',gender, evolution:String(evolution??0),egg:eggGroups.join('・')||'未発見',silhouette:sprite(p)}}
const generationLabels={
 'generation-i':'第一世代（赤・緑・青・ピカチュウ）',
 'generation-ii':'第二世代（金・銀・クリスタル）',
 'generation-iii':'第三世代（ルビー・サファイア・エメラルド）',
 'generation-iv':'第四世代（ダイヤモンド・パール・プラチナ）',
 'generation-v':'第五世代（ブラック・ホワイト）',
 'generation-vi':'第六世代（X・Y）',
 'generation-vii':'第七世代（サン・ムーン）',
 'generation-viii':'第八世代（ソード・シールド）',
 'generation-ix':'第九世代（スカーレット・バイオレット）'
};
function jaGeneration(g){return generationLabels[g]||g}
// PokéAPIの言語データが英語だけの場合にも、日本語を表示する。
const eggGroupLabels={
 'monster':'かいじゅう','water1':'すいちゅう1','water2':'すいちゅう2','water3':'すいちゅう3',
 'bug':'むし','flying':'ひこう','ground':'りくじょう','fairy':'ようせい',
 'plant':'しょくぶつ','humanshape':'ひとがた','mineral':'こうぶつ',
 'indeterminate':'ふていけい','ditto':'メタモン','dragon':'ドラゴン',
 'no-eggs':'タマゴみはっけん','no-eggs-discovered':'タマゴみはっけん'
};
function jaEggGroup(group,apiData){
 const name=group.name;
 return eggGroupLabels[name]||ja(apiData.names,name);
}

// 作品の「初登場」分類。世代だけで一括扱いしない。
const works=[
 ['red-blue','第一世代｜赤・緑・青・ピカチュウ','generation-i'],
 ['gold-silver','第二世代｜金・銀・クリスタル','generation-ii'],
 ['ruby-sapphire','第三世代｜ルビー・サファイア','generation-iii'],
 ['diamond-pearl','第四世代｜ダイヤモンド・パール','generation-iv'],
 ['black-white','第五世代｜ブラック・ホワイト','generation-v'],
 ['xy','第六世代｜X・Y','generation-vi'],
 ['oras','第六世代｜オメガルビー・アルファサファイア','generation-vi'],
 ['sun-moon','第七世代｜サン・ムーン','generation-vii'],
 ['sword-shield','第八世代｜ソード・シールド','generation-viii'],
 ['legends-arceus','第八世代｜LEGENDS アルセウス','generation-viii'],
 ['scarlet-violet','第九世代｜スカーレット・バイオレット','generation-ix'],
 ['legends-za','第九世代｜LEGENDS Z-A','generation-ix']
];
const workLabels=Object.fromEntries(works.map(([id,label])=>[id,label.split('｜').at(-1)]));
// PLAで初登場した新種。ヒスイの姿は下の別フォーム定義で扱う。
const plaSpecies=new Set([899,900,901,902,903,904,905]);
const defaultSettings={scope:'all',works:works.filter(x=>x[2]).map(x=>x[0]),evolutionFilter:'all'};
function readSettings(){try{const saved=JSON.parse(localStorage.getItem('yd-guesser-settings-v04'));if(saved)return {scope:saved.scope==='custom'?'custom':'all',works:Array.isArray(saved.works)?saved.works.filter(x=>works.some(w=>w[0]===x&&w[2])):defaultSettings.works,evolutionFilter:saved.evolutionFilter==='final'?'final':'all'};
// 旧v0.3の設定を引き継ぐ
const old=JSON.parse(localStorage.getItem('yd-guesser-settings-v03'));if(!old)return {...defaultSettings};return {scope:old.scope==='custom'?'custom':'all',works:works.filter(w=>old.generations?.includes(w[2])&&w[2]).map(w=>w[0]),evolutionFilter:old.evolutionFilter==='final'?'final':'all'};
}catch{return {...defaultSettings}}}
let settings=readSettings();
const generationChoices=$('generationChoices');
for(const [id,label,gen] of works){const row=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name='work';input.value=id;input.disabled=!gen;row.append(input,document.createTextNode(label));generationChoices.append(row)}
function fillSettings(){const form=$('settingsForm');form.elements.scope.value=settings.scope;form.elements.evolutionFilter.value=settings.evolutionFilter;for(const input of form.querySelectorAll('input[name="work"]'))input.checked=settings.works.includes(input.value);updateChoiceState();$('settingsError').textContent=''}
function updateChoiceState(){generationChoices.classList.toggle('disabled',$('settingsForm').elements.scope.value!=='custom')}
$('settingsForm').addEventListener('change',updateChoiceState);
$('settingsButton').addEventListener('click',()=>{fillSettings();$('settingsDialog').showModal()});
$('closeSettings').addEventListener('click',()=>$('settingsDialog').close());
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;const next={scope:form.elements.scope.value,works:[...form.querySelectorAll('input[name="work"]:checked')].map(x=>x.value),evolutionFilter:form.elements.evolutionFilter.value};if(next.scope==='custom'&&!next.works.length){$('settingsError').textContent='作品を1つ以上選んでね。';return}settings=next;try{localStorage.setItem('yd-guesser-settings-v04',JSON.stringify(settings))}catch(e){console.warn(e)}$('settingsDialog').close();makeQuestion()});
function updateSettingsSummary(){const scope=settings.scope==='all'?'全作品（対応済み）':settings.works.map(x=>workLabels[x]).join('・');$('settingSummary').textContent=`出題範囲：${scope} ／ ${settings.evolutionFilter==='final'?'最終進化のみ':'進化しぼりなし'}`}
function speciesId(url){const match=url.match(/\/(\d+)\/?$/);return match?Number(match[1]):null}
function workForSpecies(id,gen){if(plaSpecies.has(id))return 'legends-arceus';if(gen==='generation-viii')return 'sword-shield';if(gen==='generation-ix')return 'scarlet-violet';return ({'generation-i':'red-blue','generation-ii':'gold-silver','generation-iii':'ruby-sapphire','generation-iv':'diamond-pearl','generation-v':'black-white','generation-vi':'xy','generation-vii':'sun-moon'})[gen]}
// 種族値・タイプなどが変わる代表的な特殊フォルム。APIにあるものだけ採用。
// firstWork は姿の初登場作品。見た目のみの違いは登録しない。
const formEntries=[
 ...['venusaur','charizard-x','charizard-y','blastoise','beedrill','pidgeot','alakazam','slowbro','gengar','kangaskhan','pinsir','gyarados','aerodactyl','mewtwo-x','mewtwo-y','ampharos','steelix','scizor','heracross','houndoom','tyranitar','sceptile','blaziken','swampert','gardevoir','sableye','mawile','aggron','medicham','manectric','sharpedo','camerupt','altaria','banette','absol','glalie','salamence','metagross','latias','latios','lopunny','garchomp','lucario','abomasnow','gallade','audino','diancie','rayquaza'].map(n=>({slug:'mega-'+n,work:['sceptile','blaziken','swampert','sableye','sharpedo','camerupt','altaria','glalie','salamence','metagross','lopunny','gallade','audino','diancie','rayquaza'].includes(n)?'oras':'xy'})),
 {slug:'kyogre-primal',work:'oras'},{slug:'groudon-primal',work:'oras'},
 ...['rattata','raticate','raichu','sandshrew','sandslash','vulpix','ninetales','diglett','dugtrio','meowth','persian','geodude','graveler','golem','grimer','muk','exeggutor','marowak'].map(n=>({slug:n+'-alola',work:'sun-moon'})),
 ...['meowth','ponyta','rapidash','slowpoke','slowbro','farfetchd','weezing','mr-mime','articuno','zapdos','moltres','slowking','corsola','zigzagoon','linoone','darumaka','darmanitan','yamask','stunfisk'].map(n=>({slug:n+'-galar',work:'sword-shield'})),
 ...['growlithe','arcanine','voltorb','electrode','typhlosion','qwilfish','sneasel','samurott','lilligant','zorua','zoroark','braviary','sliggoo','goodra','avalugg','decidueye'].map(n=>({slug:n+'-hisui',work:'legends-arceus'})),
 ...['rotom-heat','rotom-wash','rotom-frost','rotom-fan','rotom-mow'].map(slug=>({slug,work:'diamond-pearl'})),
 {slug:'giratina-origin',work:'diamond-pearl'},{slug:'shaymin-sky',work:'diamond-pearl'},
 {slug:'palafin-hero',work:'scarlet-violet'},{slug:'ogerpon-wellspring-mask',work:'scarlet-violet'},{slug:'ogerpon-hearthflame-mask',work:'scarlet-violet'},{slug:'ogerpon-cornerstone-mask',work:'scarlet-violet'}
];
// v0.5: 能力・タイプ・特性などが変化する追加フォルム（見た目だけの差は除外）
const moreForms=[
 ...['deoxys-attack','deoxys-defense','deoxys-speed','wormadam-sandy','wormadam-trash','castform-sunny','castform-rainy','castform-snowy','cherrim-sunshine','burmy-sandy','burmy-trash'].map(slug=>({slug,work:slug.startsWith('deoxys')?'ruby-sapphire':'diamond-pearl'})),
 ...['dialga-origin','palkia-origin','basculin-white-striped'].map(slug=>({slug,work:'legends-arceus'})),
 ...['darmanitan-zen','tornadus-therian','thundurus-therian','landorus-therian','kyurem-black','kyurem-white','keldeo-resolute','meloetta-pirouette'].map(slug=>({slug,work:'black-white'})),
 ...['aegislash-blade','zygarde-10','zygarde-complete','hoopa-unbound','pumpkaboo-small','pumpkaboo-large','pumpkaboo-super','gourgeist-small','gourgeist-large','gourgeist-super'].map(slug=>({slug,work:'xy'})),
 ...['oricorio-pom-pom','oricorio-pau','oricorio-sensu','lycanroc-midnight','lycanroc-dusk','wishiwashi-school','minior-red-meteor','minior-orange-meteor','minior-yellow-meteor','minior-green-meteor','minior-blue-meteor','minior-indigo-meteor','minior-violet-meteor','necrozma-dusk','necrozma-dawn','necrozma-ultra'].map(slug=>({slug,work:'sun-moon'})),
 ...['toxtricity-low-key','eiscue-noice','morpeko-hangry','urshifu-rapid-strike','calyrex-ice','calyrex-shadow','zacian-crowned','zamazenta-crowned','eternatus-eternamax'].map(slug=>({slug,work:'sword-shield'})),
 ...['tauros-paldea-combat-breed','tauros-paldea-blaze-breed','tauros-paldea-aqua-breed','wooper-paldea','gimmighoul-roaming','palafin-hero','maushold-family-of-three','squawkabilly-blue-plumage','squawkabilly-yellow-plumage','squawkabilly-white-plumage','tatsugiri-droopy','tatsugiri-stretchy','ogerpon-wellspring-mask','ogerpon-hearthflame-mask','ogerpon-cornerstone-mask','terapagos-terastal','terapagos-stellar'].map(slug=>({slug,work:'scarlet-violet'}))
];
formEntries.push(...moreForms);
// 重複登録したフォームは一度だけ出題する。
const uniqueForms=new Map(formEntries.map(f=>[f.slug,f]));
formEntries.length=0;formEntries.push(...uniqueForms.values());


// Z-A本編・M次元ラッシュで初登場した全48種類のメガフォルム（姿違いを含む）。
const zaForms=[
 {slug:'raichu-mega-x',id:26,stats:[60,135,95,90,95,110],name:'メガライチュウX',work:'legends-za'},
 {slug:'raichu-mega-y',id:26,stats:[60,100,55,160,80,130],name:'メガライチュウY',work:'legends-za'},
 {slug:'clefable-mega',id:36,stats:[95,80,93,135,110,70],name:'メガピクシー',work:'legends-za'},
 {slug:'victreebel-mega',id:71,stats:[80,125,85,135,95,70],name:'メガウツボット',work:'legends-za'},
 {slug:'starmie-mega',id:121,stats:[60,140,105,130,105,120],name:'メガスターミー',work:'legends-za'},
 {slug:'dragonite-mega',id:149,stats:[91,124,115,145,125,100],name:'メガカイリュー',work:'legends-za'},
 {slug:'meganium-mega',id:154,stats:[80,92,115,143,115,80],name:'メガメガニウム',work:'legends-za'},
 {slug:'feraligatr-mega',id:160,stats:[85,160,125,89,93,78],name:'メガオーダイル',work:'legends-za'},
 {slug:'skarmory-mega',id:227,stats:[65,140,110,40,100,110],name:'メガエアームド',work:'legends-za'},
 {slug:'chimecho-mega',id:358,stats:[75,50,110,135,120,65],name:'メガチリーン',work:'legends-za'},
 {slug:'absol-mega-z',id:359,stats:[65,154,60,75,60,151],name:'メガアブソルZ',work:'legends-za'},
 {slug:'staraptor-mega',id:398,stats:[85,140,100,60,90,110],name:'メガムクホーク',work:'legends-za'},
 {slug:'garchomp-mega-z',id:445,stats:[108,130,85,141,85,151],name:'メガガブリアスZ',work:'legends-za'},
 {slug:'lucario-mega-z',id:448,stats:[70,100,70,164,70,151],name:'メガルカリオZ',work:'legends-za'},
 {slug:'froslass-mega',id:478,stats:[70,80,70,140,100,120],name:'メガユキメノコ',work:'legends-za'},
 {slug:'heatran-mega',id:485,stats:[91,120,106,175,141,67],name:'メガヒードラン',work:'legends-za'},
 {slug:'darkrai-mega',id:491,stats:[70,120,130,165,130,85],name:'メガダークライ',work:'legends-za'},
 {slug:'emboar-mega',id:500,stats:[110,148,75,110,110,75],name:'メガエンブオー',work:'legends-za'},
 {slug:'excadrill-mega',id:530,stats:[110,165,100,65,65,103],name:'メガドリュウズ',work:'legends-za'},
 {slug:'scolipede-mega',id:545,stats:[60,140,149,75,99,62],name:'メガペンドラー',work:'legends-za'},
 {slug:'scrafty-mega',id:560,stats:[65,130,135,55,135,68],name:'メガズルズキン',work:'legends-za'},
 {slug:'eelektross-mega',id:604,stats:[85,145,80,135,90,80],name:'メガシビルドン',work:'legends-za'},
 {slug:'chandelure-mega',id:609,stats:[60,75,110,175,110,90],name:'メガシャンデラ',work:'legends-za'},
 {slug:'golurk-mega',id:623,stats:[89,159,105,70,105,55],name:'メガゴルーグ',work:'legends-za'},
 {slug:'chesnaught-mega',id:652,stats:[88,137,172,74,115,44],name:'メガブリガロン',work:'legends-za'},
 {slug:'delphox-mega',id:655,stats:[75,69,72,159,125,134],name:'メガマフォクシー',work:'legends-za'},
 {slug:'greninja-mega',id:658,stats:[72,125,77,133,81,142],name:'メガゲッコウガ',work:'legends-za'},
 {slug:'pyroar-mega',id:668,stats:[86,88,92,129,86,126],name:'メガカエンジシ',work:'legends-za'},
 {slug:'floette-mega',id:670,stats:[74,85,87,155,148,102],name:'メガフラエッテ',work:'legends-za'},
 {slug:'meowstic-mega',id:678,stats:[74,48,76,143,101,124],name:'メガニャオニクス',work:'legends-za'},
 {slug:'malamar-mega',id:687,stats:[86,102,88,98,120,88],name:'メガカラマネロ',work:'legends-za'},
 {slug:'barbaracle-mega',id:689,stats:[72,140,130,64,106,88],name:'メガガメノデス',work:'legends-za'},
 {slug:'dragalge-mega',id:691,stats:[65,85,105,132,163,44],name:'メガドラミドロ',work:'legends-za'},
 {slug:'hawlucha-mega',id:701,stats:[78,137,100,74,93,118],name:'メガルチャブル',work:'legends-za'},
 {slug:'zygarde-mega',id:718,stats:[216,70,91,216,85,100],name:'メガジガルデ',work:'legends-za'},
 {slug:'crabominable-mega',id:740,stats:[97,157,122,62,107,33],name:'メガケケンカニ',work:'legends-za'},
 {slug:'golisopod-mega',id:768,stats:[75,150,175,70,120,40],name:'メガグソクムシャ',work:'legends-za'},
 {slug:'drampa-mega',id:780,stats:[78,85,110,160,116,36],name:'メガジジーロン',work:'legends-za'},
 {slug:'magearna-mega',id:801,stats:[80,125,115,170,115,95],name:'メガマギアナ',work:'legends-za'},
 {slug:'magearna-original-mega',id:801,stats:[80,125,115,170,115,95],name:'メガマギアナ（500年前の色）',work:'legends-za'},
 {slug:'zeraora-mega',id:807,stats:[88,157,75,147,80,153],name:'メガゼラオラ',work:'legends-za'},
 {slug:'falinks-mega',id:870,stats:[65,135,135,70,65,100],name:'メガタイレーツ',work:'legends-za'},
 {slug:'scovillain-mega',id:952,stats:[65,138,85,138,85,75],name:'メガスコヴィラン',work:'legends-za'},
 {slug:'glimmora-mega',id:970,stats:[83,90,105,150,96,101],name:'メガキラフロル',work:'legends-za'},
 {slug:'tatsugiri-curly-mega',id:978,stats:[68,65,90,135,125,92],name:'メガシャリタツ（そったすがた）',work:'legends-za'},
 {slug:'tatsugiri-droopy-mega',id:978,stats:[68,65,90,135,125,92],name:'メガシャリタツ（たれたすがた）',work:'legends-za'},
 {slug:'tatsugiri-stretchy-mega',id:978,stats:[68,65,90,135,125,92],name:'メガシャリタツ（のびたすがた）',work:'legends-za'},
 {slug:'baxcalibur-mega',id:998,stats:[115,175,117,105,101,87],name:'メガセグレイブ',work:'legends-za'}
];

// メガリザードンX等はAPIで「charizard-mega-x」の形式。
function fixSlug(s){return s.startsWith('mega-')?s.slice(5).replace(/-(x|y)$/,'')+'-mega'+(s.endsWith('-x')?'-x':s.endsWith('-y')?'-y':''):s}
async function getPool(){
 const selected=settings.scope==='all'?defaultSettings.works:settings.works;
 const gens=[...new Set(works.filter(w=>selected.includes(w[0])&&w[2]).map(w=>w[2]))];
 const datasets=await Promise.all(gens.map(g=>getJson(`${API}/generation/${g}`)));
 const candidates=[];
 for(const data of datasets)for(const item of data.pokemon_species){const id=speciesId(item.url);if(id&&id<=1025){const work=workForSpecies(id,data.name);if(selected.includes(work))candidates.push({id,work})}}
 for(const f of formEntries)if(selected.includes(f.work))candidates.push({slug:fixSlug(f.slug),work:f.work});
 for(const f of zaForms)if(selected.includes(f.work))candidates.push({...f,za:true});
 return candidates;
}
function isFinalEvolution(node,speciesNumber){if(speciesId(node.species.url)===speciesNumber)return node.evolves_to.length===0;for(const child of node.evolves_to){const found=isFinalEvolution(child,speciesNumber);if(found!==null)return found}return null}
async function makeQuestion(){const id=++token;solved=false;current=null;updateSettingsSummary();$('status').textContent='ポケモンを選んでいます…';$('feedback').textContent='';$('answer').value='';closeSuggestions();$('reveal').hidden=true;$('hints').replaceChildren();$('answer').disabled=true;try{
 const pool=await getPool();if(id!==token)return;if(!pool.length)throw Error('出題対象がありません');
 const candidates=[...pool];let number,p,s,evo,work;
 while(candidates.length){const index=Math.floor(Math.random()*candidates.length);const candidate=candidates[index];candidates[index]=candidates[candidates.length-1];candidates.pop();
  try{p=await getJson(`${API}/pokemon/${candidate.slug||candidate.id}`)}catch(err){
    if(candidate.za && String(err).includes('404')){
      // API未登録フォームは基礎種のデータと確認済み種族値を併用。
      p={...(await getJson(`${API}/pokemon/${candidate.id}`)),name:candidate.slug,abilities:[],
         stats:candidate.stats.map(n=>({base_stat:n})),
         sprites:{other:{'official-artwork':{front_default:null}},front_default:null}};
    }else if(candidate.slug&&String(err).includes('404'))continue;else throw err;
  }
  if(candidate.za){
    // Z-Aの画像はShowdown公開スプライトを補助として使う。
    // 存在しない画像を通常姿に置き換えない。
    const img=p.sprites.other?.['official-artwork']?.front_default||p.sprites.front_default;
    const fallback=`https://play.pokemonshowdown.com/sprites/ani/${candidate.slug}.gif`;
    p={...p,stats:candidate.stats.map(n=>({base_stat:n})),sprites:{other:{'official-artwork':{front_default:img||fallback}},front_default:img||fallback}};
  }
  s=await getJson(p.species.url);number=speciesId(p.species.url);evo=await getJson(s.evolution_chain.url);if(id!==token)return;
  if(settings.evolutionFilter==='all'||isFinalEvolution(evo.chain,number)===true){work=candidate.work;break}
  number=null;
 }
 if(!number)throw Error('この条件で出題できるポケモンが見つかりません');
 const details=await Promise.all([...p.abilities.map(a=>getJson(a.ability.url)),...p.types.map(t=>getJson(t.type.url)),...s.egg_groups.map(e=>getJson(e.url))]);if(id!==token)return;
 const abilities=details.slice(0,p.abilities.length).map((a,i)=>ja(a.names,p.abilities[i].ability.name));
 if(zaForms.some(f=>f.slug===p.name) && p.abilities.length && !p.sprites.other?.['official-artwork']?.front_default?.includes('raw.githubusercontent')){ /* API優先 */ }
 const types=details.slice(p.abilities.length,p.abilities.length+p.types.length).map((t,i)=>ja(t.names,p.types[i].type.name));
 const eggs=details.slice(p.abilities.length+p.types.length).map((e,i)=>jaEggGroup(s.egg_groups[i],e));
 const gender=s.gender_rate===-1?'性別不明':`♂${(8-s.gender_rate)*12.5}% / ♀${s.gender_rate*12.5}%`;
 const formName=p.name!==s.name?p.name:null;
 const za=zaForms.find(f=>f.slug===p.name);
 const displayName=za?za.name:(formName?`${ja(s.names,s.name)}（${formJapanese(formName,s.name)}）`:ja(s.names,s.name));
 const baseName=ja(s.names,s.name);
 const speciesText=japaneseSpeciesText(s,baseName,displayName);
 current={name:displayName,baseName,english:p.name,number,hints:{...displayHints(p,s,abilities,types,eggs,gender,evolutionPosition(evo.chain,number).stage,work),...speciesText},evolution:evolutionHint(evolutionPosition(evo.chain,number))};renderHints();$('status').textContent='ポケモンを推理しよう！';$('answer').disabled=false;refreshSuggestions();
 }catch(e){if(id!==token)return;console.error(e);$('status').textContent='取得に失敗しました';$('feedback').textContent='通信状況を確認して「次の問題」を押してね。'}}
function renderHints(){const container=$('hints');container.replaceChildren();for(const [key,label] of hintDefinitions){const b=document.createElement('button');b.type='button';b.className='hint'+(['type','ability','egg','pokedex','silhouette'].includes(key)?' wide':'');const title=document.createElement('span');title.className='label';title.textContent=label;b.append(title);const content=document.createElement('span');content.className='locked';content.textContent='🔒 タップして開く';b.append(content);b.addEventListener('click',()=>{if(b.classList.contains('open'))return;b.classList.add('open');content.remove();if(key==='evolution'){
 const info=current.evolution;
 const diagram=document.createElement('span');diagram.className='evo-diagram';diagram.setAttribute('aria-label',`全${info.total}段階中${info.stage+1}段階目`);
 for(let i=0;i<info.total;i++){
  if(i){const line=document.createElement('span');line.className='evo-line';diagram.append(line)}
  const dot=document.createElement('span');dot.className='evo-dot'+(i===info.stage?' active':'');diagram.append(dot)
 }
 const note=document.createElement('span');note.className='evo-comment';note.textContent=info.comment;b.append(diagram,note)
 }else if(key==='silhouette'){const img=document.createElement('img');img.className='silhouette';img.src=current.hints.silhouette||'';img.alt='ポケモンのシルエット';b.append(img)}else{const value=document.createElement('span');value.className='value';value.textContent=current.hints[key];b.append(value)}});container.append(b)}}
function formJapanese(form,base){const suffix=form.startsWith(base+'-')?form.slice(base.length+1):form;const map={'mega':'メガシンカ','mega-x':'メガX','mega-y':'メガY','primal':'ゲンシカイキ','alola':'アローラのすがた','galar':'ガラルのすがた','hisui':'ヒスイのすがた','origin':'オリジンフォルム','sky':'スカイフォルム','heat':'ヒートロトム','wash':'ウォッシュロトム','frost':'フロストロトム','fan':'スピンロトム','mow':'カットロトム','hero':'マイティフォルム','wellspring-mask':'いどのめん','hearthflame-mask':'かまどのめん','cornerstone-mask':'いしずえのめん','attack':'アタックフォルム','defense':'ディフェンスフォルム','speed':'スピードフォルム','therian':'れいじゅうフォルム','origin':'オリジンフォルム','black':'ブラックキュレム','white':'ホワイトキュレム','blade':'ブレードフォルム','dusk':'たそがれのたてがみ','dawn':'あかつきのつばさ','ultra':'ウルトラネクロズマ','rapid-strike':'れんげきのかた','ice':'はくばじょうのすがた','shadow':'こくばじょうのすがた','crowned':'けんのおう／たてのおう','paldea-combat-breed':'パルデア・コンバット種','paldea-blaze-breed':'パルデア・ブレイズ種','paldea-aqua-breed':'パルデア・ウォーター種','paldea':'パルデアのすがた','terastal':'テラスタルフォルム','stellar':'ステラフォルム'};return map[suffix]||suffix.replace(/-/g,'・')}
function normalized(s){return s.normalize('NFKC').replace(/[\s・･ー\-（）()]/g,'').toLowerCase()}
// 回答候補は全種族の日本語名データから作る。出題ポケモンだけを表示しない。
const namesUrl='https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv';
let nameIndex=[], nameLoading=null;
const specialSuffixes={'alola':'アローラ','galar':'ガラル','hisui':'ヒスイ','mega':'メガ','mega-x':'メガX','mega-y':'メガY','primal':'ゲンシ'};
function parseCsvLine(line){const cols=[];let part='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='\"'){if(quoted&&line[i+1]==='\"'){part+='\"';i++}else quoted=!quoted}else if(c===','&&!quoted){cols.push(part);part=''}else part+=c}cols.push(part);return cols}
async function loadNames(){if(nameLoading)return nameLoading;nameLoading=(async()=>{try{const res=await fetch(namesUrl);if(!res.ok)throw Error('名前データ取得失敗');const csv=await res.text();const names=new Map();for(const line of csv.split(/\r?\n/).slice(1)){if(!line)continue;const [id,lang,name]=parseCsvLine(line);if(lang==='1'||(lang==='11'&&!names.has(Number(id))))names.set(Number(id),name)}nameIndex=[...names].map(([id,name])=>({id,name,normalized:normalized(name)}));nameIndex.sort((a,b)=>a.id-b.id);refreshSuggestions()}catch(e){console.warn('日本語候補の取得に失敗:',e);nameIndex=[]}})();return nameLoading}
function closeSuggestions(){const box=$('suggestions');box.hidden=true;box.replaceChildren()}
function refreshSuggestions(){const input=$('answer');const box=$('suggestions');const query=normalized(input.value.trim());box.replaceChildren();if(!query||input.disabled||solved){box.hidden=true;return}
const found=[];const seen=new Set();function add(name){if(!name||seen.has(name)||!normalized(name).includes(query))return;seen.add(name);found.push(name)}
for(const item of nameIndex){if(item.normalized.includes(query)){add(item.name);if(found.length>=12)break}}
// 日本語の特殊フォルム名も候補に含める（元の名前で検索しても表示する）。
for(const f of formEntries){const slug=fixSlug(f.slug);const suffix=Object.keys(specialSuffixes).find(x=>slug.endsWith('-'+x));if(!suffix)continue;const base=slug.slice(0,-suffix.length-1);const item=nameIndex.find(n=>n.name&&n.id===speciesIdsByEnglish[base]);if(item){const label=item.name+'（'+specialSuffixes[suffix]+'）';if(normalized(item.name).includes(query)||normalized(label).includes(query))add(label)}if(found.length>=16)break}
for(const f of zaForms)if(normalized(f.name).includes(query))add(f.name);
// 出題中の正解を候補に特別追加しない（ネタバレ防止）。
for(const name of found.slice(0,12)){const b=document.createElement('button');b.type='button';b.className='suggestion';b.textContent=name;b.addEventListener('click',()=>{input.value=name;closeSuggestions();input.focus()});box.append(b)}box.hidden=!box.childElementCount}
// 特殊フォルム用の代表的な英語名と図鑑番号（候補生成の補助）。
const speciesIdsByEnglish={'charizard':6,'venusaur':3,'blastoise':9,'zoroark':571,'zorua':570,'raichu':26,'gengar':94,'mewtwo':150,'typhlosion':157,'goodra':706,'rotom':479};
$('answer').addEventListener('input',refreshSuggestions);
$('answer').addEventListener('focus',refreshSuggestions);
$('answer').addEventListener('keydown',e=>{if(e.key==='Escape')closeSuggestions()});
document.addEventListener('click',e=>{if(!e.target.closest('.answer-entry'))closeSuggestions()});
loadNames();
$('answerForm').addEventListener('submit',e=>{e.preventDefault();if(!current||solved)return;const value=$('answer').value.trim();if(!value)return;if([current.name,current.english,current.baseName].some(n=>normalized(n)===normalized(value)) || (current.name!==current.baseName && normalized(value)===normalized(current.baseName+'（'+formJapanese(current.english,current.english.split('-')[0])+'）'))){solved=true;closeSuggestions();$('feedback').textContent='大正解！ 🎉';$('pokemonImage').src=current.hints.silhouette||'';$('pokemonName').textContent=current.name;$('reveal').hidden=false;$('answer').disabled=true}else{$('feedback').textContent='おしい！ヒントを開いてもう一度考えよう！';$('answer').select()}});
$('next').addEventListener('click',makeQuestion);makeQuestion();
