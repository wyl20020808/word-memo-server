/**
 * 批量获取考研单词数据
 * 从免费词典API获取单词释义
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// 考研核心词汇列表（约5500词，这里列出常用的）
const KAOYAN_WORDS = [
  // A
  'abandon','ability','able','abnormal','aboard','abolish','abortion','about','above','abroad',
  'absence','absent','absolute','absolutely','absorb','abstract','absurd','abundance','abundant','abuse',
  'academic','academy','accelerate','accent','accept','acceptable','acceptance','access','accessible','accident',
  'accidental','accommodate','accommodation','accompany','accomplish','accomplishment','accord','accordance','according','accordingly',
  'account','accountant','accumulate','accuracy','accurate','accuse','accustomed','ache','achieve','achievement',
  'acid','acknowledge','acquaint','acquaintance','acquire','acquisition','acre','across','act','action',
  'active','activity','actor','actress','actual','actually','acute','adapt','adaptation','add',
  'addict','addition','additional','address','adequate','adhere','adjacent','adjective','adjust','adjustment',
  'administer','administration','administrative','administrator','admirable','admiral','admire','admission','admit','adolescent',
  'adopt','adoption','adult','advance','advanced','advantage','adventure','adverb','adverse','advertise',
  'advertisement','advice','advise','adviser','advocate','affair','affect','affection','affiliate','affirm',
  'afford','afraid','after','afternoon','afterward','afterwards','again','against','age','aged',
  'agency','agenda','agent','aggressive','ago','agony','agree','agreeable','agreement','agriculture',
  'ahead','aid','aim','air','aircraft','airline','airplane','airport','alarm','album',
  'alcohol','alert','alien','alike','alive','all','allege','alliance','allocate','allow',
  'allowance','ally','almost','alone','along','alongside','aloud','alphabet','already','also',
  'alter','alternative','although','altogether','always','amateur','amaze','amazing','ambassador','ambition',
  'ambitious','ambulance','amend','amendment','amid','among','amount','ample','amuse','amusement',
  'analyse','analysis','analyst','analyze','ancestor','anchor','ancient','and','anger','angle',
  'angry','animal','ankle','anniversary','announce','announcement','annoy','annual','anonymous','another',
  // B
  'baby','back','background','backward','bacteria','bad','badly','bag','baggage','bake',
  'balance','ball','balloon','ban','banana','band','bang','bank','banker','banking',
  'bankrupt','banner','bar','bare','barely','bargain','barn','barrel','barrier','base',
  'baseball','basement','basic','basically','basin','basis','basket','basketball','bat','batch',
  'bath','bathe','bathroom','battery','battle','bay','be','beach','beam','bean',
  'bear','beard','bearing','beast','beat','beautiful','beauty','because','become','bed',
  'bedroom','bee','beef','beer','before','beforehand','beg','begin','beginner','beginning',
  'behalf','behave','behavior','behaviour','behind','being','belief','believe','bell','belong',
  'beloved','below','belt','bench','bend','beneath','beneficial','benefit','beside','besides',
  'best','bet','betray','better','between','beyond','bias','bible','bicycle','bid',
  'big','bike','bill','billion','bind','biography','biological','biology','bird','birth',
  'birthday','biscuit','bit','bite','bitter','black','blade','blame','blank','blanket',
  'blast','bleed','blend','bless','blind','block','blood','bloody','bloom','blow',
  'blue','board','boast','boat','body','boil','bold','bomb','bond','bone',
  'bonus','book','boom','boost','boot','booth','border','bore','boring','born',
  'borrow','boss','both','bother','bottle','bottom','bounce','bound','boundary','bow',
  'bowl','box','boy','brain','brake','branch','brand','brave','bread','break',
  'breakdown','breakfast','breast','breath','breathe','breed','breeze','brick','bride','bridge',
  'brief','bright','brilliant','bring','broad','broadcast','broken','brother','brown','brush',
  'bubble','bucket','budget','build','building','bulk','bullet','bunch','bundle','burden',
  // C
  'cabinet','cable','cafe','cage','cake','calculate','calculation','calendar','call','calm',
  'camera','camp','campaign','campus','can','canal','cancel','cancer','candidate','candle',
  'candy','cap','capable','capacity','capital','captain','capture','car','carbon','card',
  'care','career','careful','carefully','careless','cargo','carpet','carriage','carrier','carry',
  'cart','cartoon','carve','case','cash','casino','cast','castle','casual','cat',
  'catalog','catalogue','catch','category','cater','cattle','cause','caution','cautious','cave',
  'cease','ceiling','celebrate','celebration','celebrity','cell','cement','cemetery','census','cent',
  'center','central','centre','century','cereal','ceremony','certain','certainly','certainty','certificate',
  'chain','chair','chairman','challenge','chamber','champion','championship','chance','change','channel',
  'chaos','chapter','character','characteristic','characterize','charge','charity','charm','chart','chase',
  'chat','cheap','cheat','check','cheek','cheer','cheerful','cheese','chemical','chemistry',
  'cheque','cherry','chess','chest','chicken','chief','child','childhood','children','chin',
  'china','chip','chocolate','choice','choose','chop','christian','christmas','church','cigarette',
  'cinema','circle','circuit','circular','circulate','circulation','circumstance','cite','citizen','city',
  'civil','civilian','civilization','claim','clap','clarify','clarity','clash','class','classic',
  'classical','classification','classify','classmate','classroom','clause','clay','clean','clear','clearly',
  'clerk','clever','click','client','cliff','climate','climb','cling','clinic','clinical',
  'clock','clone','close','closely','closet','cloth','clothe','clothes','clothing','cloud',
  'cloudy','club','clue','cluster','coach','coal','coalition','coarse','coast','coastal',
  'coat','code','coffee','cognitive','coin','coincide','coincidence','cold','collapse','collar',
  // D-Z 继续添加...
  'damage','damp','dance','danger','dangerous','dare','dark','darkness','data','database',
  'date','daughter','dawn','day','daylight','dead','deadline','deadly','deaf','deal',
  'dealer','dear','death','debate','debt','decade','decay','deceive','december','decent',
  'decide','decision','deck','declaration','declare','decline','decorate','decoration','decrease','dedicate',
  'deed','deem','deep','deeply','deer','defeat','defect','defence','defend','defendant',
  'defense','defensive','deficit','define','definite','definitely','definition','degree','delay','delegate',
  'delete','deliberate','delicate','delight','deliver','delivery','demand','democracy','democratic','demonstrate',
  'demonstration','denial','dense','density','deny','depart','department','departure','depend','dependent',
  'deposit','depress','depression','depth','deputy','derive','descend','describe','description','desert',
  'deserve','design','designer','desirable','desire','desk','desperate','despite','destination','destiny',
];

// 输出文件路径
const OUTPUT_FILE = path.join(__dirname, '../data/all-words.json');
