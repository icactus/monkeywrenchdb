//########################################
//# This page contains score data, timing data and the media file path. Save it as a javascipt file in
//# the same folder as synpdf.html. Synpdf preloads score and media when it is opened with the
//# file name as parameter in the url, for example: http://your.domain.org/synpdf.html?file_name.js
//# Also works locally with file:///path/to/synpdf.html?file_name.js
//# **** You may have to correct the path to the media file below! (media_file="...";) ****
//########################################
//#
pdf_file = "13-50.pdf";
media_file = "";
msc_tracks = "";
offset_js = 0.00;
opt = {"speed":1,"no_menu":0,"btns":1,"spdctl":1,"cropx":0,"drmpl":0.4,"pagewd":1000,"synbox":0,
"wpdf":1,"lncsr":0,"nomed":0,"noplyr":0,"nodash":0,"skipn":0,"drmpl2":2,"seln":0,"delay":0,
"ipaddr":"","mstr":0,"bpmsr":"4-20-1","loop":false,"annot":0,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,
"dx":3,"fscr":0,"pagenum":1,"playbtn":0,"mmin":"","fixwd":1000,"lastSynced":-1,"eerst":false,
"sysprf":false,"onestf":false,"advncd":false,"yubvid":"3QS8p5TNzFI","media_height":"200px"};
lpRec = {"loopBtn":1,"loopStart":0,"loopEnd":7200};
times_arr = [{"t":0,"mix":0},{"t":0,"mix":1},{"t":0,"mix":2},{"t":0,"mix":3},{"t":0,"mix":4},
{"t":0,"mix":5},{"t":0,"mix":6},{"t":0,"mix":7},{"t":0,"mix":8},{"t":0,"mix":9},{"t":0,"mix":10},
{"t":0,"mix":11},{"t":0,"mix":12},{"t":0,"mix":13},{"t":0,"mix":14},{"t":0,"mix":15},{"t":0,
"mix":16},{"t":0,"mix":17},{"t":0,"mix":18},{"t":0,"mix":19},{"t":2.861,"mix":20},{"t":4.358,
"mix":21},{"t":6.597,"mix":22},{"t":8,"mix":23},{"t":10,"mix":24},{"t":12,"mix":25},{"t":14,
"mix":26},{"t":16,"mix":27},{"t":18,"mix":28},{"t":20,"mix":29},{"t":22,"mix":30},{"t":24,
"mix":31},{"t":26,"mix":32},{"t":28,"mix":33},{"t":30,"mix":34},{"t":32,"mix":35},{"t":34,
"mix":36},{"t":0,"mix":0},{"t":2,"mix":1},{"t":2,"mix":2},{"t":2,"mix":3},{"t":2,"mix":4},
{"t":2,"mix":5},{"t":2,"mix":6},{"t":2,"mix":7},{"t":2,"mix":8},{"t":2,"mix":9},{"t":2,"mix":10},
{"t":2,"mix":11},{"t":2,"mix":12},{"t":2,"mix":13},{"t":2,"mix":14},{"t":2,"mix":15},{"t":2,
"mix":16},{"t":2,"mix":17},{"t":2,"mix":18},{"t":2,"mix":19},{"t":2,"mix":20},{"t":4.861000000000001,
"mix":21},{"t":6.358,"mix":22},{"t":8.597000000000001,"mix":23},{"t":10,"mix":24},{"t":12,
"mix":25},{"t":14,"mix":26},{"t":16,"mix":27},{"t":18,"mix":28},{"t":20,"mix":29},{"t":22,
"mix":30},{"t":24,"mix":31},{"t":26,"mix":32},{"t":28,"mix":33},{"t":30,"mix":34},{"t":32,
"mix":35},{"t":34,"mix":36}];
adv_settings = {"1":{"drmpl":0.4,"drmpl2":2,"skipn":0,"seln":0,"eerst":false,"sysprf":false,
"onestf":false,"zwgrens":0.7,"voorna":0.9,"mtdrmpl":0.8,"dx":3,"fixwd":1000},"2":{"drmpl":0.4,
"drmpl2":2,"skipn":0,"seln":0,"eerst":true,"sysprf":false,"onestf":false,"zwgrens":0.7,"voorna":0.9,
"mtdrmpl":0.8,"dx":3,"fixwd":1000}};
metric_arr = [1000,{"cxs":[{"cs":[89,96,103,110,117,164,171,178,185,192],"xs":{"x1":148,"x2":671}},
{"cs":[259,266,273,284,289,327,334,341,348,356,363],"xs":{"x1":83,"x2":915}},{"cs":[430,437,
444,451,460,498,505,512,519,527,534],"xs":{"x1":82,"x2":914}},{"cs":[601,608,615,622,629,
676,683,690,697,704],"xs":{"x1":83,"x2":911}},{"cs":[755,771,778,785,846,853,861,866,868],
"xs":{"x1":90,"x2":911}},{"cs":[941,949,956,963,970,1017,1024,1031,1039,1046],"xs":{"x1":82,
"x2":910}},{"cs":[1113,1120,1127,1135,1141,1179,1186,1201,1208],"xs":{"x1":82,"x2":909}}],
"bxs":[[148,266,588,915],[83,384,619,913],[82,455,683,912],[83,378,648,910],[90,488,909],
[82,565,908],[82,495,684,907]]},{"cxs":[{"cs":[75,82,89,97,104,147,154,161,169,176],"xs":{"x1":71,
"x2":900}},{"cs":[232,239,247,254,261,309,316,323,331,338],"xs":{"x1":79,"x2":901}},{"cs":[393,
400,407,415,422,473,481,488,495],"xs":{"x1":74,"x2":902}},{"cs":[559,566,573,581,634,641,
649,656,663],"xs":{"x1":75,"x2":903}},{"cs":[724,731,738,745,753,760,805,819,827,834],"xs":{"x1":76,
"x2":903}},{"cs":[925,932,940,947,954,991,999,1006,1013,1020,1027],"xs":{"x1":77,"x2":903}},
{"cs":[1114,1121,1128,1135,1143,1180,1188,1195],"xs":{"x1":88,"x2":906}}],"bxs":[[71,511,
899],[79,527,899],[74,445,900],[75,367,622,901],[76,386,628,901],[77,370,903],[88,538,792,
906]]}];

