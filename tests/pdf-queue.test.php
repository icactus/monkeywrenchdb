<?php
// Disposable DB and web root. Never writes to actual catalog files or records.
require_once dirname(__DIR__) . '/phpfiles/config.php';
require_once dirname(__DIR__) . '/phpfiles/part_pdf_queue.php';
if (!in_array(DB_HOST, ['localhost','127.0.0.1','::1'], true)) die('Local database required.');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$checks = 0;
function qcheck($ok, $message) { global $checks; if (!$ok) throw new RuntimeException($message); $checks++; }
function qremove($path) { foreach (scandir($path) as $name) if ($name!=='.' && $name!=='..') { $file=$path.'/'.$name; if (is_dir($file)&&!is_link($file)) qremove($file); else unlink($file); } rmdir($path); }
function qfixturePdf(string $path): void {
    $content = "0.5 w\n";
    foreach ([120,280,440,600] as $top) {
        for($line=0;$line<5;$line++){ $y=$top+$line*8; $content.="50 $y m 550 $y l S\n"; }
        foreach([50,200,380,550] as $x)$content.="$x $top m $x ".($top+32)." l S\n";
    }
    $objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 5 0 R /Resources << >> >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 5 0 R /Resources << >> >>',
        '<< /Length '.strlen($content)." >>\nstream\n".$content."endstream"];
    $pdf="%PDF-1.4\n"; $offsets=[0];
    foreach($objects as $i=>$object){$offsets[]=strlen($pdf);$pdf.=($i+1)." 0 obj\n$object\nendobj\n";}
    $start=strlen($pdf);$pdf.="xref\n0 6\n0000000000 65535 f \n";
    foreach(array_slice($offsets,1) as $offset)$pdf.=sprintf("%010d 00000 n \n",$offset);
    file_put_contents($path,$pdf."trailer << /Size 6 /Root 1 0 R >>\nstartxref\n$start\n%%EOF\n");
}
function qhttp($port, $action, $session, $id='', $data=null, $csrf=true) {
    $ch=curl_init('http://127.0.0.1:'.$port.'/editmode/part-pdf-queue.php?action='.$action.($id?'&id='.$id:''));
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_COOKIE=>'PHPSESSID='.$session]);
    if ($data!==null) { curl_setopt($ch,CURLOPT_POST,true); curl_setopt($ch,CURLOPT_POSTFIELDS,$data); if($csrf)curl_setopt($ch,CURLOPT_HTTPHEADER,['X-CSRF-Token: '.str_repeat('a',64)]); }
    $raw=curl_exec($ch);if($raw===false)throw new RuntimeException(curl_error($ch));$code=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    $result=json_decode($raw,true);if(!is_array($result))throw new RuntimeException('Invalid queue response: '.substr($raw,0,1000));return [$code,$result];
}
$root=dirname(__DIR__);$database='mw_queue_test_'.bin2hex(random_bytes(5));$fixture=sys_get_temp_dir().'/'.$database;$server=null;
$connection=new mysqli(DB_HOST,DB_USER,DB_PASSWORD,DB_NAME);
try {
    $connection->query("CREATE DATABASE `$database` CHARACTER SET utf8mb4");$db=new mysqli(DB_HOST,DB_USER,DB_PASSWORD,$database);$db->set_charset('utf8mb4');
    $db->query('CREATE TABLE users (id INT PRIMARY KEY, role VARCHAR(20))');$db->query("INSERT INTO users VALUES (1,'admin'),(2,'admin'),(3,'user')");
    $db->query('CREATE TABLE composers (composer_id INT PRIMARY KEY, composer_first VARCHAR(100), composer_last VARCHAR(100))');$db->query("INSERT INTO composers VALUES (1,'Gustav','Mahler')");
    $db->query('CREATE TABLE pieces (piece_id INT PRIMARY KEY, piece_name VARCHAR(100),composer_id INT)');$db->query("INSERT INTO pieces VALUES (71,'Test Symphony',1),(72,'Another test piece',1)");
    $db->query('CREATE TABLE instruments (instrument_id INT PRIMARY KEY,instrument_name VARCHAR(100),part_number VARCHAR(20),instrument_key VARCHAR(20))');$db->query("INSERT INTO instruments VALUES (39,'Full Score','',''),(3,'Cello','','')");
    $db->query('CREATE TABLE piece_categories(category_id INT PRIMARY KEY,category_name VARCHAR(100))');
    $db->query('CREATE TABLE metric_arr(metric_arr_id INT AUTO_INCREMENT PRIMARY KEY,piece_id INT,instrument_id INT,measures_version INT,metric_arr_data LONGTEXT,edition_label VARCHAR(100)) ENGINE=InnoDB');
    $db->query('CREATE TABLE recordings(recording_id INT PRIMARY KEY,piece_id INT)');
    mkdir($fixture,0700);mkdir($fixture.'/public/editmode',0700,true);mkdir($fixture.'/public/sessions',0700);mkdir($fixture.'/phpfiles',0700);mkdir($fixture.'/queue',0700);
    $python=trim(shell_exec('command -v python3'));
    $config=['DB_HOST'=>DB_HOST,'DB_USER'=>DB_USER,'DB_PASSWORD'=>DB_PASSWORD,'DB_NAME'=>$database,'MW_PDF_QUEUE_DIRECTORY'=>$fixture.'/queue','MW_PDF_QUEUE_PYTHON'=>$python,'MW_PDF_QUEUE_WORKER'=>$root.'/scripts/process-pdf-queue.py'];
    $text='<?php ';foreach($config as $key=>$value)$text.='define('.var_export($key,true).','.var_export($value,true).');';
    file_put_contents($fixture.'/phpfiles/config.php',$text);chmod($fixture.'/phpfiles/config.php',0600);file_put_contents($fixture.'/phpfiles/read_only_user_config.php',$text);
    foreach(['part_pdf_queue.php','metric-arr-functions.php','get_pieces_and_composers.php'] as $file)copy($root.'/phpfiles/'.$file,$fixture.'/phpfiles/'.$file);
    copy($root.'/session_config.php',$fixture.'/public/session_config.php');
    foreach(['part-pdf-queue.php','synpdf-edit-mode.php','get_parts.php','get_metric_arr.php'] as $file)copy($root.'/synpdf_182/editmode/'.$file,$fixture.'/public/editmode/'.$file);
    foreach(glob($root.'/synpdf_182/editmode/*') as $path)if(is_file($path)&&preg_match('/\.(js|css)$/',$path))symlink($path,$fixture.'/public/editmode/'.basename($path));
    symlink($root.'/synpdf_182/editmode/vendor',$fixture.'/public/editmode/vendor');symlink($root.'/synpdf_182/models',$fixture.'/public/models');symlink($root.'/assets',$fixture.'/public/assets');
    $sessions=[];foreach(['owner'=>1,'admin'=>2,'user'=>3,'guest'=>0] as $role=>$id){$s=bin2hex(random_bytes(16));$sessions[$role]=$s;file_put_contents($fixture.'/public/sessions/sess_'.$s,'pdf_queue_csrf|s:64:"'.str_repeat('a',64).'";user_id|i:'.$id.';user_role|s:5:"admin";');}
    $socket=stream_socket_server('tcp://127.0.0.1:0');$port=(int)substr(strrchr(stream_socket_get_name($socket,false),':'),1);fclose($socket);
    $server=proc_open([PHP_BINARY,'-S','127.0.0.1:'.$port,'-t',$fixture.'/public'],[0=>['file','/dev/null','r'],1=>['file',$fixture.'/web.log','a'],2=>['file',$fixture.'/web.log','a']],$pipes);
    for($i=0;$i<50;$i++){if($s=@fsockopen('127.0.0.1',$port)){fclose($s);break;}usleep(20000);}
    [$code,$owner]=qhttp($port,'list',$sessions['owner']);qcheck($code===200&&$owner['can_upload'],'Primary admin can upload.');
    [$code,$admin]=qhttp($port,'list',$sessions['admin']);qcheck($code===200&&!$admin['can_upload'],'Other admins can review but cannot upload.');
    qcheck(qhttp($port,'list',$sessions['user'])[0]===403,'Stale forged admin role cannot access the queue.');qcheck(qhttp($port,'list',$sessions['guest'])[0]===403,'Guest cannot access the queue.');
    $source=$fixture.'/source.pdf'; qfixturePdf($source);
    $input=['name'=>'71-39.pdf','size'=>filesize($source),'piece_id'=>71,'instrument_id'=>39];
    qcheck(qhttp($port,'create',$sessions['admin'],'',$input)[0]===403,'Non-owner admin cannot upload via direct API.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',$input,false)[0]===403,'Upload requires CSRF.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['piece_id'=>99999]))[0]===400,'Unknown piece ID is rejected.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['name'=>'../bad.pdf']))[0]===400,'Filenames cannot escape the queue folder.');
    [$code,$created]=qhttp($port,'create',$sessions['owner'],'',$input);qcheck($code===200,'Create queued PDF.');$id=$created['item']['id'];
    qcheck(qhttp($port,'finish',$sessions['owner'],$id,[])[0]===400,'Incomplete uploads cannot start compression.');
    $part=substr(file_get_contents($source),0,1024);file_put_contents($fixture.'/chunk.bin',$part);
    $chunk=['offset'=>0,'chunk'=>new CURLFile($fixture.'/chunk.bin')];
    [$code,$uploaded]=qhttp($port,'chunk',$sessions['owner'],$id,$chunk);qcheck($code===200&&$uploaded['item']['received']===1024,'Chunks stream to disk.');
    qcheck(qhttp($port,'chunk',$sessions['owner'],$id,$chunk)[1]['item']['received']===1024,'Repeated chunk retry does not duplicate bytes.');
    file_put_contents($fixture.'/chunk.bin',str_repeat('x',1024));qcheck(qhttp($port,'chunk',$sessions['owner'],$id,$chunk)[0]===400,'Mismatched retry is rejected.');
    file_put_contents($fixture.'/chunk.bin',substr(file_get_contents($source),1024));
    qcheck(qhttp($port,'chunk',$sessions['owner'],$id,['offset'=>1024,'chunk'=>new CURLFile($fixture.'/chunk.bin')])[0]===200,'Interrupted upload can resume.');
    qcheck(hash_file('sha256',$source)===hash_file('sha256',$fixture.'/queue/'.$id.'/hd.pdf'),'HD source preserved byte for byte.');
    qcheck(qhttp($port,'finish',$sessions['owner'],$id,[])[0]===200,'Finished upload starts server compression.');
    $ready=null;for($i=0;$i<100;$i++){usleep(150000);$ready=qhttp($port,'get',$sessions['owner'],$id)[1]['item'];if(in_array($ready['status'],['ready','error']))break;}
    qcheck($ready['status']==='ready'&&$ready['pages']===2,'Actual background worker produces a two-page PDF: '.json_encode($ready));
    $metrics=[1000,['cxs'=>[['cs'=>[100,160],'xs'=>['x1'=>50,'x2'=>950]]],'bxs'=>[[50,350,650,950]]],['cxs'=>[],'bxs'=>[]]];
    $save=['piece_id'=>71,'instrument_id'=>39,'metrics'=>json_encode($metrics),'edition_label'=>'','measures_version'=>1];
    qcheck(qhttp($port,'draft',$sessions['admin'],$id,$save)[0]===200,'Reviewing admin can autosave geometry.');
    qcheck(qhttp($port,'get',$sessions['admin'],$id)[1]['draft']['metrics']===$metrics,'Queue geometry restores across sessions.');
    qcheck(qhttp($port,'draft',$sessions['owner'],$id,$save)[0]===400,'A stale tab cannot overwrite another saved draft.');
    $save['revision']=1;
    qcheck(qhttp($port,'publish',$sessions['admin'],$id,$save)[0]===400,'Publication requires explicit page review.');
    file_put_contents($fixture.'/public/blocked-file','preserve');mkdir($fixture.'/public/pdfs');file_put_contents($fixture.'/public/pdfs/71-39.pdf','existing');
    qcheck(qhttp($port,'publish',$sessions['admin'],$id,$save+['reviewed'=>'1'])[0]===403,'Publication never overwrites an existing PDF.');
    qcheck(file_get_contents($fixture.'/public/pdfs/71-39.pdf')==='existing'&&(int)$db->query('SELECT COUNT(*) FROM metric_arr')->fetch_row()[0]===0,'Conflict preserves files and rolls back database changes.');unlink($fixture.'/public/pdfs/71-39.pdf');
    [$code,$published]=qhttp($port,'publish',$sessions['admin'],$id,$save+['reviewed'=>'1']);qcheck($code===200&&$published['item']['status']==='completed','Reviewed part publishes to library.');
    qcheck(hash_file('sha256',$source)===hash_file('sha256',$fixture.'/public/hd-pdfs/71-39.pdf'),'Published HD source is exact.');
    qcheck(json_decode(file_get_contents($fixture.'/public/data/metrics/'.$published['item']['metric_arr_id'].'.json'),true)===$metrics,'Static metrics are normalized and published.');
    qcheck(qhttp($port,'publish',$sessions['admin'],$id,$save+['reviewed'=>'1'])[0]===200&&(int)$db->query('SELECT COUNT(*) FROM metric_arr')->fetch_row()[0]===1,'Publication retry is idempotent.');
    if(in_array('--browser',$argv,true)){echo json_encode(['fixture'=>$fixture,'port'=>$port,'sessions'=>$sessions])."\nBrowser fixture ready. Press Enter.\n";fgets(STDIN);}
    echo "Passed $checks PDF queue checks.\n";
} finally { if(is_resource($server)){proc_terminate($server);proc_close($server);} $connection->query("DROP DATABASE IF EXISTS `$database`");if(is_dir($fixture))qremove($fixture); }
