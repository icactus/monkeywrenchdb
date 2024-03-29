import xml.etree.ElementTree as ET
import json
import re
import pyperclip

def normalize(num, max_val):
    new_max = 1000
    normalized_num = (num/max_val)*new_max
    return round(normalized_num, 1)

def extract_staff_data(xml_data):
    root = ET.fromstring(xml_data)
    page_data = []

    picture = root.find('picture')
    max_val = float(picture.attrib['width'])

    for page in root.iter('page'):
        page_info = {"cxs": [], "bxs": []}
        for system in page.iter('system'):
            bxs = []
            for barline in system.iter('barline'):
                bxs.append(normalize(float(barline.find('bounds').attrib['x']), max_val))
            page_info['bxs'].append(bxs)
            for staff in system.iter('staff'):
                staff_info = {}
                cs = []
                for line in staff.iter('line'):
                    points = list(line.iter('point'))
                    cs.append(normalize(float(points[0].attrib['y']), max_val))
                staff_info['cs'] = cs
                staff_info['xs'] = {"x1": normalize(float(staff.attrib['left']), max_val), "x2": normalize(float(staff.attrib['right']), max_val)}
                page_info['cxs'].append(staff_info)
        page_data.append(page_info)

    return page_data

xml_data = """<?xml version="1.0" ?>
<sheet last-persistent-id="313">
  <picture width="1999" height="2631">
    <images>
      <entry>
        <key>GRAY</key>
        <value path="GRAY.png"/>
      </entry>
      <entry>
        <key>BINARY</key>
        <value path="BINARY.png"/>
      </entry>
    </images>
  </picture>
  <scale>
    <interline min="13" main="14" max="15"/>
    <line min="2" main="3" max="4"/>
    <beam main-thickness="10"/>
  </scale>
  <skew slope="0.00086"/>
  <page id="1" movement-start="true">
    <system id="1" indented="true">
      <part id="1">
        <staff id="1" left="188" right="1876">
          <lines>
            <line thickness="2.6" glyph="259">
              <point x="188" y="457.8"/>
              <point x="1876" y="457"/>
            </line>
            <line thickness="2.7" glyph="260">
              <point x="188" y="472"/>
              <point x="1032" y="472"/>
              <point x="1876" y="470.5"/>
            </line>
            <line thickness="2.8" glyph="261">
              <point x="188" y="486"/>
              <point x="1032" y="486.4"/>
              <point x="1876" y="484.5"/>
            </line>
            <line thickness="2.6" glyph="262">
              <point x="188" y="500.7"/>
              <point x="1032" y="501"/>
              <point x="1876" y="499"/>
            </line>
            <line thickness="2.6" glyph="263">
              <point x="188" y="514.6"/>
              <point x="1032" y="514.7"/>
              <point x="1876" y="513.2"/>
            </line>
          </lines>
          <barlines>2 4 6 8 10 12 14 16 18 20</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="6" shape="THIN_BARLINE" glyph="1" grade="0.8" ctx-grade="0.8" staff="1" id="2">
            <bounds x="557" y="457" w="6" h="60"/>
            <median>
              <p1 x="560" y="457"/>
              <p2 x="560" y="517"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="3" grade="0.767" ctx-grade="0.767" staff="1" id="4">
            <bounds x="680" y="457" w="4" h="60"/>
            <median>
              <p1 x="682" y="457"/>
              <p2 x="682" y="517"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="5" grade="0.742" ctx-grade="0.742" staff="1" id="6">
            <bounds x="879" y="456" w="4" h="60"/>
            <median>
              <p1 x="881" y="456"/>
              <p2 x="881" y="516"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="7" grade="0.767" ctx-grade="0.767" staff="1" id="8">
            <bounds x="999" y="456" w="4" h="60"/>
            <median>
              <p1 x="1001" y="456"/>
              <p2 x="1001" y="516"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="9" grade="0.779" ctx-grade="0.779" staff="1" id="10">
            <bounds x="1121" y="456" w="5" h="60"/>
            <median>
              <p1 x="1123.5" y="456"/>
              <p2 x="1123.5" y="516"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="11" grade="0.767" ctx-grade="0.767" staff="1" id="12">
            <bounds x="1252" y="456" w="4" h="60"/>
            <median>
              <p1 x="1254" y="456"/>
              <p2 x="1254" y="516"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="13" grade="0.777" ctx-grade="0.777" staff="1" id="14">
            <bounds x="1389" y="456" w="4" h="60"/>
            <median>
              <p1 x="1391" y="456"/>
              <p2 x="1391" y="516"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="15" grade="0.8" ctx-grade="0.8" staff="1" id="16">
            <bounds x="1589" y="456" w="5" h="60"/>
            <median>
              <p1 x="1591.5" y="456"/>
              <p2 x="1591.5" y="516"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="17" grade="0.777" ctx-grade="0.777" staff="1" id="18">
            <bounds x="1712" y="456" w="5" h="60"/>
            <median>
              <p1 x="1714.5" y="456"/>
              <p2 x="1714.5" y="516"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="5" shape="THIN_BARLINE" glyph="19" grade="0.789" ctx-grade="0.789" staff="1" id="20">
            <bounds x="1874" y="455" w="5" h="59"/>
            <median>
              <p1 x="1876.5" y="455"/>
              <p2 x="1876.5" y="514"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="2">
      <part id="1">
        <staff id="2" left="126" right="1877">
          <lines>
            <line thickness="2.8" glyph="264">
              <point x="126" y="646"/>
              <point x="1877" y="643.5"/>
            </line>
            <line thickness="2.6" glyph="265">
              <point x="126" y="660"/>
              <point x="563.8" y="660"/>
              <point x="1001.5" y="659.5"/>
              <point x="1439.2" y="658"/>
              <point x="1877" y="657"/>
            </line>
            <line thickness="2.8" glyph="266">
              <point x="126" y="673.9"/>
              <point x="563.8" y="674"/>
              <point x="1001.5" y="672.4"/>
              <point x="1439.2" y="672.5"/>
              <point x="1877" y="671.3"/>
            </line>
            <line thickness="2.9" glyph="267">
              <point x="126" y="688.4"/>
              <point x="1001.5" y="687.2"/>
              <point x="1877" y="685.5"/>
            </line>
            <line thickness="2.6" glyph="268">
              <point x="126" y="702.3"/>
              <point x="1877" y="700"/>
            </line>
          </lines>
          <barlines>22 24 26 28 30 32 34 36 38 40 42 44 46</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="5" shape="THIN_BARLINE" glyph="21" grade="0.792" ctx-grade="0.792" staff="2" id="22">
            <bounds x="354" y="645" w="5" h="58"/>
            <median>
              <p1 x="356.5" y="645"/>
              <p2 x="356.5" y="703"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="23" grade="0.777" ctx-grade="0.777" staff="2" id="24">
            <bounds x="536" y="644" w="5" h="60"/>
            <median>
              <p1 x="538.5" y="644"/>
              <p2 x="538.5" y="704"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="25" grade="0.779" ctx-grade="0.779" staff="2" id="26">
            <bounds x="648" y="644" w="5" h="59"/>
            <median>
              <p1 x="650.5" y="644"/>
              <p2 x="650.5" y="703"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="27" grade="0.523" ctx-grade="0.523" staff="2" id="28">
            <bounds x="717" y="645" w="3" h="58"/>
            <median>
              <p1 x="718.5" y="645"/>
              <p2 x="718.5" y="703"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="29" grade="0.767" ctx-grade="0.767" staff="2" id="30">
            <bounds x="839" y="644" w="5" h="59"/>
            <median>
              <p1 x="841.5" y="644"/>
              <p2 x="841.5" y="703"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="31" grade="0.76" ctx-grade="0.76" staff="2" id="32">
            <bounds x="956" y="644" w="4" h="58"/>
            <median>
              <p1 x="958" y="644"/>
              <p2 x="958" y="702"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="33" grade="0.48" ctx-grade="0.48" staff="2" id="34">
            <bounds x="1108" y="644" w="3" h="58"/>
            <median>
              <p1 x="1109.5" y="644"/>
              <p2 x="1109.5" y="702"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="35" grade="0.779" ctx-grade="0.779" staff="2" id="36">
            <bounds x="1153" y="643" w="4" h="60"/>
            <median>
              <p1 x="1155" y="643"/>
              <p2 x="1155" y="703"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="37" grade="0.8" ctx-grade="0.8" staff="2" id="38">
            <bounds x="1270" y="643" w="5" h="59"/>
            <median>
              <p1 x="1272.5" y="643"/>
              <p2 x="1272.5" y="702"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="39" grade="0.755" ctx-grade="0.755" staff="2" id="40">
            <bounds x="1461" y="642" w="5" h="61"/>
            <median>
              <p1 x="1463.5" y="642"/>
              <p2 x="1463.5" y="703"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="41" grade="0.767" ctx-grade="0.767" staff="2" id="42">
            <bounds x="1609" y="642" w="4" h="60"/>
            <median>
              <p1 x="1611" y="642"/>
              <p2 x="1611" y="702"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="43" grade="0.742" ctx-grade="0.742" staff="2" id="44">
            <bounds x="1759" y="642" w="3" h="59"/>
            <median>
              <p1 x="1760.5" y="642"/>
              <p2 x="1760.5" y="701"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="5" shape="THIN_BARLINE" glyph="45" grade="0.746" ctx-grade="0.746" staff="2" id="46">
            <bounds x="1875" y="642" w="5" h="59"/>
            <median>
              <p1 x="1877.5" y="642"/>
              <p2 x="1877.5" y="701"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="3">
      <part id="1">
        <staff id="3" left="126" right="1876">
          <lines>
            <line thickness="2.5" glyph="269">
              <point x="126" y="827.5"/>
              <point x="1876" y="826.5"/>
            </line>
            <line thickness="2.7" glyph="270">
              <point x="126" y="841.4"/>
              <point x="1876" y="840.4"/>
            </line>
            <line thickness="2.6" glyph="271">
              <point x="126" y="855.5"/>
              <point x="563.5" y="855"/>
              <point x="1001" y="855"/>
              <point x="1438.5" y="853.9"/>
              <point x="1876" y="854.3"/>
            </line>
            <line thickness="2.7" glyph="272">
              <point x="126" y="869"/>
              <point x="1876" y="868.6"/>
            </line>
            <line thickness="2.7" glyph="273">
              <point x="126" y="883.9"/>
              <point x="563.5" y="883.4"/>
              <point x="1001" y="882.9"/>
              <point x="1438.5" y="882"/>
              <point x="1876" y="883.2"/>
            </line>
          </lines>
          <barlines>48 50 52 54 56 58 60 62 64 66 68 70 72</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="4" shape="THIN_BARLINE" glyph="47" grade="0.759" ctx-grade="0.759" staff="3" id="48">
            <bounds x="425" y="826" w="4" h="59"/>
            <median>
              <p1 x="427" y="826"/>
              <p2 x="427" y="885"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="49" grade="0.781" ctx-grade="0.781" staff="3" id="50">
            <bounds x="534" y="826" w="5" h="59"/>
            <median>
              <p1 x="536.5" y="826"/>
              <p2 x="536.5" y="885"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="51" grade="0.771" ctx-grade="0.771" staff="3" id="52">
            <bounds x="641" y="826" w="5" h="59"/>
            <median>
              <p1 x="643.5" y="826"/>
              <p2 x="643.5" y="885"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="53" grade="0.749" ctx-grade="0.749" staff="3" id="54">
            <bounds x="818" y="826" w="4" h="59"/>
            <median>
              <p1 x="820" y="826"/>
              <p2 x="820" y="885"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="55" grade="0.781" ctx-grade="0.781" staff="3" id="56">
            <bounds x="929" y="825" w="5" h="59"/>
            <median>
              <p1 x="931.5" y="825"/>
              <p2 x="931.5" y="884"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="57" grade="0.738" ctx-grade="0.738" staff="3" id="58">
            <bounds x="1039" y="825" w="4" h="60"/>
            <median>
              <p1 x="1041" y="825"/>
              <p2 x="1041" y="885"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="59" grade="0.759" ctx-grade="0.759" staff="3" id="60">
            <bounds x="1145" y="825" w="5" h="59"/>
            <median>
              <p1 x="1147.5" y="825"/>
              <p2 x="1147.5" y="884"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="61" grade="0.749" ctx-grade="0.749" staff="3" id="62">
            <bounds x="1343" y="824" w="4" h="60"/>
            <median>
              <p1 x="1345" y="824"/>
              <p2 x="1345" y="884"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="63" grade="0.667" ctx-grade="0.667" staff="3" id="64">
            <bounds x="1405" y="825" w="4" h="58"/>
            <median>
              <p1 x="1407" y="825"/>
              <p2 x="1407" y="883"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="65" grade="0.749" ctx-grade="0.749" staff="3" id="66">
            <bounds x="1454" y="824" w="4" h="60"/>
            <median>
              <p1 x="1456" y="824"/>
              <p2 x="1456" y="884"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="67" grade="0.738" ctx-grade="0.738" staff="3" id="68">
            <bounds x="1566" y="824" w="5" h="60"/>
            <median>
              <p1 x="1568.5" y="824"/>
              <p2 x="1568.5" y="884"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="69" grade="0.771" ctx-grade="0.771" staff="3" id="70">
            <bounds x="1679" y="824" w="4" h="60"/>
            <median>
              <p1 x="1681" y="824"/>
              <p2 x="1681" y="884"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="4" shape="THIN_BARLINE" glyph="71" grade="0.754" ctx-grade="0.754" staff="3" id="72">
            <bounds x="1875" y="824" w="4" h="60"/>
            <median>
              <p1 x="1877" y="824"/>
              <p2 x="1877" y="884"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="4">
      <part id="1">
        <staff id="4" left="166" right="1876">
          <lines>
            <line thickness="2.3" glyph="274">
              <point x="166" y="1009.9"/>
              <point x="1876" y="1010.7"/>
            </line>
            <line thickness="2.8" glyph="275">
              <point x="166" y="1023.7"/>
              <point x="1876" y="1024.5"/>
            </line>
            <line thickness="2.7" glyph="276">
              <point x="166" y="1038"/>
              <point x="1876" y="1039.1"/>
            </line>
            <line thickness="3.2" glyph="277">
              <point x="166" y="1052.2"/>
              <point x="1876" y="1053"/>
            </line>
            <line thickness="2.7" glyph="278">
              <point x="166" y="1066.7"/>
              <point x="1876" y="1067.4"/>
            </line>
          </lines>
          <barlines>74 76 78 80 82 84 86 88 90 92 94</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="5" shape="THIN_BARLINE" glyph="73" grade="0.789" ctx-grade="0.789" staff="4" id="74">
            <bounds x="336" y="1009" w="5" h="59"/>
            <median>
              <p1 x="338.5" y="1009"/>
              <p2 x="338.5" y="1068"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="75" grade="0.753" ctx-grade="0.753" staff="4" id="76">
            <bounds x="531" y="1009" w="5" h="58"/>
            <median>
              <p1 x="533.5" y="1009"/>
              <p2 x="533.5" y="1067"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="77" grade="0.742" ctx-grade="0.742" staff="4" id="78">
            <bounds x="639" y="1008" w="4" h="60"/>
            <median>
              <p1 x="641" y="1008"/>
              <p2 x="641" y="1068"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="79" grade="0.755" ctx-grade="0.755" staff="4" id="80">
            <bounds x="831" y="1008" w="5" h="60"/>
            <median>
              <p1 x="833.5" y="1008"/>
              <p2 x="833.5" y="1068"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="81" grade="0.664" ctx-grade="0.664" staff="4" id="82">
            <bounds x="991" y="1009" w="3" h="59"/>
            <median>
              <p1 x="992.5" y="1009"/>
              <p2 x="992.5" y="1068"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="83" grade="0.767" ctx-grade="0.767" staff="4" id="84">
            <bounds x="1035" y="1008" w="4" h="60"/>
            <median>
              <p1 x="1037" y="1008"/>
              <p2 x="1037" y="1068"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="85" grade="0.631" ctx-grade="0.631" staff="4" id="86">
            <bounds x="1205" y="1009" w="4" h="59"/>
            <median>
              <p1 x="1207" y="1009"/>
              <p2 x="1207" y="1068"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="87" grade="0.777" ctx-grade="0.777" staff="4" id="88">
            <bounds x="1253" y="1008" w="5" h="60"/>
            <median>
              <p1 x="1255.5" y="1008"/>
              <p2 x="1255.5" y="1068"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="89" grade="0.8" ctx-grade="0.8" staff="4" id="90">
            <bounds x="1463" y="1009" w="4" h="59"/>
            <median>
              <p1 x="1465" y="1009"/>
              <p2 x="1465" y="1068"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="91" grade="0.725" ctx-grade="0.725" staff="4" id="92">
            <bounds x="1670" y="1008" w="4" h="61"/>
            <median>
              <p1 x="1672" y="1008"/>
              <p2 x="1672" y="1069"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="5" shape="THIN_BARLINE" glyph="93" grade="0.777" ctx-grade="0.777" staff="4" id="94">
            <bounds x="1874" y="1009" w="5" h="60"/>
            <median>
              <p1 x="1876.5" y="1009"/>
              <p2 x="1876.5" y="1069"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="5">
      <part id="1">
        <staff id="5" left="126" right="1876">
          <lines>
            <line thickness="2.3" glyph="279">
              <point x="126" y="1201.1"/>
              <point x="1876" y="1203.6"/>
            </line>
            <line thickness="3" glyph="280">
              <point x="126" y="1215"/>
              <point x="1876" y="1217.5"/>
            </line>
            <line thickness="2.6" glyph="281">
              <point x="126" y="1229"/>
              <point x="1876" y="1231.6"/>
            </line>
            <line thickness="2.9" glyph="282">
              <point x="126" y="1243.6"/>
              <point x="1876" y="1245.8"/>
            </line>
            <line thickness="2.4" glyph="283">
              <point x="126" y="1258"/>
              <point x="1001" y="1257.9"/>
              <point x="1876" y="1260.1"/>
            </line>
          </lines>
          <barlines>96 98 100 102 104 106 108 110 112 114</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="5" shape="THIN_BARLINE" glyph="95" grade="0.774" ctx-grade="0.774" staff="5" id="96">
            <bounds x="407" y="1201" w="5" h="58"/>
            <median>
              <p1 x="409.5" y="1201"/>
              <p2 x="409.5" y="1259"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="97" grade="0.724" ctx-grade="0.724" staff="5" id="98">
            <bounds x="567" y="1200" w="5" h="59"/>
            <median>
              <p1 x="569.5" y="1200"/>
              <p2 x="569.5" y="1259"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="99" grade="0.708" ctx-grade="0.708" staff="5" id="100">
            <bounds x="727" y="1201" w="4" h="59"/>
            <median>
              <p1 x="729" y="1201"/>
              <p2 x="729" y="1260"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="101" grade="0.761" ctx-grade="0.761" staff="5" id="102">
            <bounds x="913" y="1201" w="5" h="59"/>
            <median>
              <p1 x="915.5" y="1201"/>
              <p2 x="915.5" y="1260"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="103" grade="0.771" ctx-grade="0.771" staff="5" id="104">
            <bounds x="1097" y="1201" w="4" h="59"/>
            <median>
              <p1 x="1099" y="1201"/>
              <p2 x="1099" y="1260"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="105" grade="0.738" ctx-grade="0.738" staff="5" id="106">
            <bounds x="1298" y="1201" w="4" h="60"/>
            <median>
              <p1 x="1300" y="1201"/>
              <p2 x="1300" y="1261"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="107" grade="0.336" ctx-grade="0.336" staff="5" id="108">
            <bounds x="1442" y="1201" w="3" h="59"/>
            <median>
              <p1 x="1443.5" y="1201"/>
              <p2 x="1443.5" y="1260"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="109" grade="0.724" ctx-grade="0.724" staff="5" id="110">
            <bounds x="1484" y="1201" w="4" h="60"/>
            <median>
              <p1 x="1486" y="1201"/>
              <p2 x="1486" y="1261"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="111" grade="0.771" ctx-grade="0.771" staff="5" id="112">
            <bounds x="1681" y="1202" w="5" h="60"/>
            <median>
              <p1 x="1683.5" y="1202"/>
              <p2 x="1683.5" y="1262"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="5" shape="THIN_BARLINE" glyph="113" grade="0.754" ctx-grade="0.754" staff="5" id="114">
            <bounds x="1874" y="1202" w="5" h="60"/>
            <median>
              <p1 x="1876.5" y="1202"/>
              <p2 x="1876.5" y="1262"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="6">
      <part id="1">
        <staff id="6" left="127" right="1878">
          <lines>
            <line thickness="2.6" glyph="284">
              <point x="127" y="1396"/>
              <point x="1878" y="1397.6"/>
            </line>
            <line thickness="2.7" glyph="285">
              <point x="127" y="1409.4"/>
              <point x="1878" y="1411.9"/>
            </line>
            <line thickness="3.1" glyph="286">
              <point x="127" y="1424"/>
              <point x="1878" y="1425.9"/>
            </line>
            <line thickness="2.4" glyph="287">
              <point x="127" y="1438"/>
              <point x="1002.5" y="1438.9"/>
              <point x="1878" y="1440.4"/>
            </line>
            <line thickness="2.7" glyph="288">
              <point x="127" y="1453"/>
              <point x="1878" y="1454.5"/>
            </line>
          </lines>
          <barlines>116 118 120 122 124 126 128 130 132 134</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="5" shape="THIN_BARLINE" glyph="115" grade="0.8" ctx-grade="0.8" staff="6" id="116">
            <bounds x="437" y="1395" w="5" h="59"/>
            <median>
              <p1 x="439.5" y="1395"/>
              <p2 x="439.5" y="1454"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="117" grade="0.779" ctx-grade="0.779" staff="6" id="118">
            <bounds x="626" y="1395" w="4" h="59"/>
            <median>
              <p1 x="628" y="1395"/>
              <p2 x="628" y="1454"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="119" grade="0.742" ctx-grade="0.742" staff="6" id="120">
            <bounds x="816" y="1395" w="4" h="60"/>
            <median>
              <p1 x="818" y="1395"/>
              <p2 x="818" y="1455"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="121" grade="0.789" ctx-grade="0.789" staff="6" id="122">
            <bounds x="1039" y="1395" w="4" h="60"/>
            <median>
              <p1 x="1041" y="1395"/>
              <p2 x="1041" y="1455"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="123" grade="0.8" ctx-grade="0.8" staff="6" id="124">
            <bounds x="1186" y="1396" w="4" h="59"/>
            <median>
              <p1 x="1188" y="1396"/>
              <p2 x="1188" y="1455"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="125" grade="0.779" ctx-grade="0.779" staff="6" id="126">
            <bounds x="1312" y="1395" w="4" h="60"/>
            <median>
              <p1 x="1314" y="1395"/>
              <p2 x="1314" y="1455"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="127" grade="0.8" ctx-grade="0.8" staff="6" id="128">
            <bounds x="1471" y="1396" w="4" h="59"/>
            <median>
              <p1 x="1473" y="1396"/>
              <p2 x="1473" y="1455"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="129" grade="0.8" ctx-grade="0.8" staff="6" id="130">
            <bounds x="1612" y="1395" w="4" h="60"/>
            <median>
              <p1 x="1614" y="1395"/>
              <p2 x="1614" y="1455"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="131" grade="0.779" ctx-grade="0.779" staff="6" id="132">
            <bounds x="1701" y="1395" w="4" h="61"/>
            <median>
              <p1 x="1703" y="1395"/>
              <p2 x="1703" y="1456"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="133" grade="0.728" ctx-grade="0.728" staff="6" id="134">
            <bounds x="1787" y="1396" w="3" h="61"/>
            <median>
              <p1 x="1788.5" y="1396"/>
              <p2 x="1788.5" y="1457"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="7">
      <part id="1">
        <staff id="7" left="125" right="1876">
          <lines>
            <line thickness="2.4" glyph="289">
              <point x="125" y="1582.5"/>
              <point x="1876" y="1584.7"/>
            </line>
            <line thickness="2.5" glyph="290">
              <point x="125" y="1596.6"/>
              <point x="1876" y="1598.8"/>
            </line>
            <line thickness="2.6" glyph="291">
              <point x="125" y="1610.9"/>
              <point x="1876" y="1612.8"/>
            </line>
            <line thickness="2.3" glyph="292">
              <point x="125" y="1624.1"/>
              <point x="1876" y="1626.6"/>
            </line>
            <line thickness="2.4" glyph="293">
              <point x="125" y="1639"/>
              <point x="1876" y="1640.8"/>
            </line>
          </lines>
          <barlines>136 138 140 142 144 146 148 150 152 154 156 158 160 162 164</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="4" shape="THIN_BARLINE" glyph="135" grade="0.8" ctx-grade="0.8" staff="7" id="136">
            <bounds x="355" y="1581" w="4" h="59"/>
            <median>
              <p1 x="357" y="1581"/>
              <p2 x="357" y="1640"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="137" grade="0.783" ctx-grade="0.783" staff="7" id="138">
            <bounds x="472" y="1582" w="3" h="58"/>
            <median>
              <p1 x="473.5" y="1582"/>
              <p2 x="473.5" y="1640"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="139" grade="0.442" ctx-grade="0.442" staff="7" id="140">
            <bounds x="497" y="1582" w="4" h="58"/>
            <median>
              <p1 x="499" y="1582"/>
              <p2 x="499" y="1640"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="141" grade="0.792" ctx-grade="0.792" staff="7" id="142">
            <bounds x="593" y="1582" w="4" h="58"/>
            <median>
              <p1 x="595" y="1582"/>
              <p2 x="595" y="1640"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="143" grade="0.792" ctx-grade="0.792" staff="7" id="144">
            <bounds x="714" y="1582" w="4" h="58"/>
            <median>
              <p1 x="716" y="1582"/>
              <p2 x="716" y="1640"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="145" grade="0.78" ctx-grade="0.78" staff="7" id="146">
            <bounds x="799" y="1581" w="4" h="59"/>
            <median>
              <p1 x="801" y="1581"/>
              <p2 x="801" y="1640"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="147" grade="0.738" ctx-grade="0.738" staff="7" id="148">
            <bounds x="890" y="1581" w="3" h="60"/>
            <median>
              <p1 x="891.5" y="1581"/>
              <p2 x="891.5" y="1641"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="149" grade="0.791" ctx-grade="0.791" staff="7" id="150">
            <bounds x="975" y="1581" w="4" h="60"/>
            <median>
              <p1 x="977" y="1581"/>
              <p2 x="977" y="1641"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="151" grade="0.78" ctx-grade="0.78" staff="7" id="152">
            <bounds x="1060" y="1582" w="4" h="59"/>
            <median>
              <p1 x="1062" y="1582"/>
              <p2 x="1062" y="1641"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="153" grade="0.771" ctx-grade="0.771" staff="7" id="154">
            <bounds x="1195" y="1582" w="5" h="59"/>
            <median>
              <p1 x="1197.5" y="1582"/>
              <p2 x="1197.5" y="1641"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="155" grade="0.749" ctx-grade="0.749" staff="7" id="156">
            <bounds x="1332" y="1582" w="4" h="59"/>
            <median>
              <p1 x="1334" y="1582"/>
              <p2 x="1334" y="1641"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="157" grade="0.761" ctx-grade="0.761" staff="7" id="158">
            <bounds x="1465" y="1582" w="5" h="59"/>
            <median>
              <p1 x="1467.5" y="1582"/>
              <p2 x="1467.5" y="1641"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="159" grade="0.761" ctx-grade="0.761" staff="7" id="160">
            <bounds x="1600" y="1582" w="5" h="60"/>
            <median>
              <p1 x="1602.5" y="1582"/>
              <p2 x="1602.5" y="1642"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="161" grade="0.759" ctx-grade="0.759" staff="7" id="162">
            <bounds x="1735" y="1583" w="4" h="59"/>
            <median>
              <p1 x="1737" y="1583"/>
              <p2 x="1737" y="1642"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="5" shape="THIN_BARLINE" glyph="163" grade="0.768" ctx-grade="0.768" staff="7" id="164">
            <bounds x="1874" y="1584" w="5" h="59"/>
            <median>
              <p1 x="1876.5" y="1584"/>
              <p2 x="1876.5" y="1643"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="8">
      <part id="1">
        <staff id="8" left="126" right="1876">
          <lines>
            <line thickness="2.7" glyph="294">
              <point x="126" y="1742"/>
              <point x="1001" y="1743.7"/>
              <point x="1876" y="1746.6"/>
            </line>
            <line thickness="2.8" glyph="295">
              <point x="126" y="1756.4"/>
              <point x="1876" y="1760.4"/>
            </line>
            <line thickness="2.4" glyph="296">
              <point x="126" y="1770.1"/>
              <point x="1876" y="1774.7"/>
            </line>
            <line thickness="2.7" glyph="297">
              <point x="126" y="1784.5"/>
              <point x="1876" y="1788.5"/>
            </line>
            <line thickness="2.6" glyph="298">
              <point x="126" y="1798.7"/>
              <point x="1876" y="1803.1"/>
            </line>
          </lines>
          <barlines>166 168 170 172 174 176 178 180 182 184 186 188 190 192</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="4" shape="THIN_BARLINE" glyph="165" grade="0.78" ctx-grade="0.78" staff="8" id="166">
            <bounds x="357" y="1742" w="4" h="59"/>
            <median>
              <p1 x="359" y="1742"/>
              <p2 x="359" y="1801"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="167" grade="0.749" ctx-grade="0.749" staff="8" id="168">
            <bounds x="479" y="1741" w="5" h="60"/>
            <median>
              <p1 x="481.5" y="1741"/>
              <p2 x="481.5" y="1801"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="169" grade="0.781" ctx-grade="0.781" staff="8" id="170">
            <bounds x="606" y="1742" w="5" h="59"/>
            <median>
              <p1 x="608.5" y="1742"/>
              <p2 x="608.5" y="1801"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="171" grade="0.791" ctx-grade="0.791" staff="8" id="172">
            <bounds x="729" y="1742" w="5" h="59"/>
            <median>
              <p1 x="731.5" y="1742"/>
              <p2 x="731.5" y="1801"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="173" grade="0.771" ctx-grade="0.771" staff="8" id="174">
            <bounds x="856" y="1742" w="5" h="59"/>
            <median>
              <p1 x="858.5" y="1742"/>
              <p2 x="858.5" y="1801"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="175" grade="0.791" ctx-grade="0.791" staff="8" id="176">
            <bounds x="987" y="1743" w="4" h="59"/>
            <median>
              <p1 x="989" y="1743"/>
              <p2 x="989" y="1802"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="177" grade="0.771" ctx-grade="0.771" staff="8" id="178">
            <bounds x="1112" y="1742" w="4" h="60"/>
            <median>
              <p1 x="1114" y="1742"/>
              <p2 x="1114" y="1802"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="179" grade="0.761" ctx-grade="0.761" staff="8" id="180">
            <bounds x="1241" y="1742" w="5" h="60"/>
            <median>
              <p1 x="1243.5" y="1742"/>
              <p2 x="1243.5" y="1802"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="181" grade="0.771" ctx-grade="0.771" staff="8" id="182">
            <bounds x="1367" y="1743" w="5" h="60"/>
            <median>
              <p1 x="1369.5" y="1743"/>
              <p2 x="1369.5" y="1803"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="183" grade="0.791" ctx-grade="0.791" staff="8" id="184">
            <bounds x="1498" y="1744" w="5" h="59"/>
            <median>
              <p1 x="1500.5" y="1744"/>
              <p2 x="1500.5" y="1803"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="185" grade="0.78" ctx-grade="0.78" staff="8" id="186">
            <bounds x="1622" y="1744" w="4" h="59"/>
            <median>
              <p1 x="1624" y="1744"/>
              <p2 x="1624" y="1803"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="187" grade="0.759" ctx-grade="0.759" staff="8" id="188">
            <bounds x="1755" y="1745" w="4" h="60"/>
            <median>
              <p1 x="1757" y="1745"/>
              <p2 x="1757" y="1805"/>
            </median>
          </barline>
          <barline width="3" shape="THIN_BARLINE" glyph="189" grade="0.494" ctx-grade="0.494" staff="8" id="190">
            <bounds x="1826" y="1745" w="3" h="60"/>
            <median>
              <p1 x="1827.5" y="1745"/>
              <p2 x="1827.5" y="1805"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="5" shape="THIN_BARLINE" glyph="191" grade="0.738" ctx-grade="0.738" staff="8" id="192">
            <bounds x="1874" y="1745" w="5" h="60"/>
            <median>
              <p1 x="1876.5" y="1745"/>
              <p2 x="1876.5" y="1805"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="9">
      <part id="1">
        <staff id="9" left="127" right="1874">
          <lines>
            <line thickness="2.6" glyph="299">
              <point x="127" y="1913.5"/>
              <point x="1000.5" y="1914.9"/>
              <point x="1874" y="1917.8"/>
            </line>
            <line thickness="2.9" glyph="300">
              <point x="127" y="1927.5"/>
              <point x="1000.5" y="1928.8"/>
              <point x="1874" y="1932.3"/>
            </line>
            <line thickness="2.7" glyph="301">
              <point x="127" y="1942"/>
              <point x="236.2" y="1942"/>
              <point x="345.4" y="1942"/>
              <point x="454.6" y="1942.4"/>
              <point x="563.8" y="1942.1"/>
              <point x="672.9" y="1942.8"/>
              <point x="782.1" y="1942.7"/>
              <point x="891.3" y="1943"/>
              <point x="1000.5" y="1943.2"/>
              <point x="1109.7" y="1943.1"/>
              <point x="1218.9" y="1943.7"/>
              <point x="1328.1" y="1943.7"/>
              <point x="1437.2" y="1944.2"/>
              <point x="1546.4" y="1944.6"/>
              <point x="1655.6" y="1945"/>
              <point x="1764.8" y="1946"/>
              <point x="1874" y="1946.1"/>
            </line>
            <line thickness="2.8" glyph="302">
              <point x="127" y="1955.6"/>
              <point x="345.4" y="1955.9"/>
              <point x="563.8" y="1955.6"/>
              <point x="782.1" y="1956.5"/>
              <point x="1000.5" y="1957.1"/>
              <point x="1218.9" y="1958.2"/>
              <point x="1437.2" y="1958.3"/>
              <point x="1655.6" y="1959.5"/>
              <point x="1874" y="1960.9"/>
            </line>
            <line thickness="2.7" glyph="303">
              <point x="127" y="1970"/>
              <point x="1000.5" y="1971.5"/>
              <point x="1874" y="1974.4"/>
            </line>
          </lines>
          <barlines>194 196 198 200 202 204 206 208 210 212</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="4" shape="THIN_BARLINE" glyph="193" grade="0.8" ctx-grade="0.8" staff="9" id="194">
            <bounds x="353" y="1912" w="4" h="60"/>
            <median>
              <p1 x="355" y="1912"/>
              <p2 x="355" y="1972"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="195" grade="0.792" ctx-grade="0.792" staff="9" id="196">
            <bounds x="462" y="1913" w="4" h="58"/>
            <median>
              <p1 x="464" y="1913"/>
              <p2 x="464" y="1971"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="197" grade="0.8" ctx-grade="0.8" staff="9" id="198">
            <bounds x="583" y="1912" w="5" h="59"/>
            <median>
              <p1 x="585.5" y="1912"/>
              <p2 x="585.5" y="1971"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="199" grade="0.696" ctx-grade="0.696" staff="9" id="200">
            <bounds x="712" y="1912" w="4" h="61"/>
            <median>
              <p1 x="714" y="1912"/>
              <p2 x="714" y="1973"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="201" grade="0.8" ctx-grade="0.8" staff="9" id="202">
            <bounds x="997" y="1914" w="5" h="59"/>
            <median>
              <p1 x="999.5" y="1914"/>
              <p2 x="999.5" y="1973"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="203" grade="0.728" ctx-grade="0.728" staff="9" id="204">
            <bounds x="1177" y="1914" w="4" h="60"/>
            <median>
              <p1 x="1179" y="1914"/>
              <p2 x="1179" y="1974"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="205" grade="0.779" ctx-grade="0.779" staff="9" id="206">
            <bounds x="1349" y="1914" w="4" h="59"/>
            <median>
              <p1 x="1351" y="1914"/>
              <p2 x="1351" y="1973"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="207" grade="0.742" ctx-grade="0.742" staff="9" id="208">
            <bounds x="1517" y="1914" w="4" h="60"/>
            <median>
              <p1 x="1519" y="1914"/>
              <p2 x="1519" y="1974"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="209" grade="0.755" ctx-grade="0.755" staff="9" id="210">
            <bounds x="1693" y="1916" w="5" h="60"/>
            <median>
              <p1 x="1695.5" y="1916"/>
              <p2 x="1695.5" y="1976"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="4" shape="THIN_BARLINE" glyph="211" grade="0.746" ctx-grade="0.746" staff="9" id="212">
            <bounds x="1873" y="1916" w="4" h="60"/>
            <median>
              <p1 x="1875" y="1916"/>
              <p2 x="1875" y="1976"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="10">
      <part id="1">
        <staff id="10" left="125" right="1874">
          <lines>
            <line thickness="3.1" glyph="304">
              <point x="125" y="2100"/>
              <point x="999.5" y="2101"/>
              <point x="1874" y="2104.5"/>
            </line>
            <line thickness="2.9" glyph="305">
              <point x="125" y="2114.5"/>
              <point x="999.5" y="2115.1"/>
              <point x="1874" y="2118.5"/>
            </line>
            <line thickness="2.7" glyph="306">
              <point x="125" y="2128.3"/>
              <point x="999.5" y="2128.9"/>
              <point x="1874" y="2132.6"/>
            </line>
            <line thickness="3" glyph="307">
              <point x="125" y="2142.5"/>
              <point x="234.3" y="2142.5"/>
              <point x="343.6" y="2142.5"/>
              <point x="452.9" y="2142.5"/>
              <point x="562.2" y="2142.5"/>
              <point x="671.6" y="2142.5"/>
              <point x="780.9" y="2142.7"/>
              <point x="890.2" y="2143.1"/>
              <point x="999.5" y="2142.9"/>
              <point x="1108.8" y="2143.4"/>
              <point x="1218.1" y="2143.8"/>
              <point x="1327.4" y="2143.6"/>
              <point x="1436.8" y="2144"/>
              <point x="1546.1" y="2145.9"/>
              <point x="1655.4" y="2145"/>
              <point x="1764.7" y="2146.3"/>
              <point x="1874" y="2146.7"/>
            </line>
            <line thickness="2.8" glyph="308">
              <point x="125" y="2156.5"/>
              <point x="562.2" y="2156.6"/>
              <point x="999.5" y="2157.5"/>
              <point x="1436.8" y="2158"/>
              <point x="1874" y="2161"/>
            </line>
          </lines>
          <barlines>214 216 218 220 222 224 226 228 230</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="4" shape="THIN_BARLINE" glyph="213" grade="0.774" ctx-grade="0.774" staff="10" id="214">
            <bounds x="428" y="2099" w="4" h="59"/>
            <median>
              <p1 x="430" y="2099"/>
              <p2 x="430" y="2158"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="215" grade="0.748" ctx-grade="0.748" staff="10" id="216">
            <bounds x="613" y="2099" w="4" h="59"/>
            <median>
              <p1 x="615" y="2099"/>
              <p2 x="615" y="2158"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="217" grade="0.748" ctx-grade="0.748" staff="10" id="218">
            <bounds x="793" y="2099" w="4" h="60"/>
            <median>
              <p1 x="795" y="2099"/>
              <p2 x="795" y="2159"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="219" grade="0.788" ctx-grade="0.788" staff="10" id="220">
            <bounds x="960" y="2099" w="5" h="60"/>
            <median>
              <p1 x="962.5" y="2099"/>
              <p2 x="962.5" y="2159"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="221" grade="0.776" ctx-grade="0.776" staff="10" id="222">
            <bounds x="1130" y="2100" w="5" h="59"/>
            <median>
              <p1 x="1132.5" y="2100"/>
              <p2 x="1132.5" y="2159"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="223" grade="0.774" ctx-grade="0.774" staff="10" id="224">
            <bounds x="1307" y="2100" w="5" h="59"/>
            <median>
              <p1 x="1309.5" y="2100"/>
              <p2 x="1309.5" y="2159"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="225" grade="0.8" ctx-grade="0.8" staff="10" id="226">
            <bounds x="1496" y="2101" w="5" h="59"/>
            <median>
              <p1 x="1498.5" y="2101"/>
              <p2 x="1498.5" y="2160"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="227" grade="0.8" ctx-grade="0.8" staff="10" id="228">
            <bounds x="1690" y="2101" w="5" h="60"/>
            <median>
              <p1 x="1692.5" y="2101"/>
              <p2 x="1692.5" y="2161"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="5" shape="THIN_BARLINE" glyph="229" grade="0.774" ctx-grade="0.774" staff="10" id="230">
            <bounds x="1872" y="2103" w="5" h="60"/>
            <median>
              <p1 x="1874.5" y="2103"/>
              <p2 x="1874.5" y="2163"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
    <system id="11">
      <part id="1">
        <staff id="11" left="125" right="1867">
          <lines>
            <line thickness="3.1" glyph="309">
              <point x="125" y="2314.6"/>
              <point x="996" y="2316"/>
              <point x="1867" y="2319.6"/>
            </line>
            <line thickness="3.2" glyph="310">
              <point x="125" y="2328.5"/>
              <point x="996" y="2329.4"/>
              <point x="1867" y="2333.4"/>
            </line>
            <line thickness="2.9" glyph="311">
              <point x="125" y="2342"/>
              <point x="996" y="2343.4"/>
              <point x="1867" y="2347.5"/>
            </line>
            <line thickness="2.9" glyph="312">
              <point x="125" y="2356.6"/>
              <point x="996" y="2357.5"/>
              <point x="1867" y="2361.4"/>
            </line>
            <line thickness="2.9" glyph="313">
              <point x="125" y="2369.7"/>
              <point x="560.5" y="2370.3"/>
              <point x="996" y="2371.5"/>
              <point x="1431.5" y="2372.4"/>
              <point x="1867" y="2375.4"/>
            </line>
          </lines>
          <barlines>232 234 236 238 240 242 244 246 248 250 252 254 256 258</barlines>
        </staff>
      </part>
      <sig>
        <inters>
          <barline width="5" shape="THIN_BARLINE" glyph="231" grade="0.784" ctx-grade="0.784" staff="11" id="232">
            <bounds x="322" y="2314" w="5" h="57"/>
            <median>
              <p1 x="324.5" y="2314"/>
              <p2 x="324.5" y="2371"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="233" grade="0.758" ctx-grade="0.758" staff="11" id="234">
            <bounds x="408" y="2314" w="5" h="57"/>
            <median>
              <p1 x="410.5" y="2314"/>
              <p2 x="410.5" y="2371"/>
            </median>
          </barline>
          <barline width="6" shape="THIN_BARLINE" glyph="235" grade="0.792" ctx-grade="0.792" staff="11" id="236">
            <bounds x="491" y="2313" w="6" h="58"/>
            <median>
              <p1 x="494" y="2313"/>
              <p2 x="494" y="2371"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="237" grade="0.728" ctx-grade="0.728" staff="11" id="238">
            <bounds x="653" y="2314" w="4" h="58"/>
            <median>
              <p1 x="655" y="2314"/>
              <p2 x="655" y="2372"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="239" grade="0.774" ctx-grade="0.774" staff="11" id="240">
            <bounds x="738" y="2314" w="5" h="59"/>
            <median>
              <p1 x="740.5" y="2314"/>
              <p2 x="740.5" y="2373"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="241" grade="0.717" ctx-grade="0.717" staff="11" id="242">
            <bounds x="822" y="2314" w="5" h="58"/>
            <median>
              <p1 x="824.5" y="2314"/>
              <p2 x="824.5" y="2372"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="243" grade="0.792" ctx-grade="0.792" staff="11" id="244">
            <bounds x="909" y="2314" w="5" h="58"/>
            <median>
              <p1 x="911.5" y="2314"/>
              <p2 x="911.5" y="2372"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="245" grade="0.731" ctx-grade="0.731" staff="11" id="246">
            <bounds x="1078" y="2314" w="5" h="59"/>
            <median>
              <p1 x="1080.5" y="2314"/>
              <p2 x="1080.5" y="2373"/>
            </median>
          </barline>
          <barline width="6" shape="THIN_BARLINE" glyph="247" grade="0.768" ctx-grade="0.768" staff="11" id="248">
            <bounds x="1199" y="2315" w="6" h="58"/>
            <median>
              <p1 x="1202" y="2315"/>
              <p2 x="1202" y="2373"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="249" grade="0.792" ctx-grade="0.792" staff="11" id="250">
            <bounds x="1360" y="2316" w="5" h="58"/>
            <median>
              <p1 x="1362.5" y="2316"/>
              <p2 x="1362.5" y="2374"/>
            </median>
          </barline>
          <barline width="4" shape="THIN_BARLINE" glyph="251" grade="0.78" ctx-grade="0.78" staff="11" id="252">
            <bounds x="1477" y="2316" w="4" h="58"/>
            <median>
              <p1 x="1479" y="2316"/>
              <p2 x="1479" y="2374"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="253" grade="0.78" ctx-grade="0.78" staff="11" id="254">
            <bounds x="1631" y="2317" w="5" h="58"/>
            <median>
              <p1 x="1633.5" y="2317"/>
              <p2 x="1633.5" y="2375"/>
            </median>
          </barline>
          <barline width="5" shape="THIN_BARLINE" glyph="255" grade="0.754" ctx-grade="0.754" staff="11" id="256">
            <bounds x="1747" y="2318" w="5" h="58"/>
            <median>
              <p1 x="1749.5" y="2318"/>
              <p2 x="1749.5" y="2376"/>
            </median>
          </barline>
          <barline staff-end="RIGHT" width="15" shape="THIN_BARLINE" glyph="257" grade="0.749" ctx-grade="0.749" staff="11" id="258">
            <bounds x="1860" y="2319" w="15" h="58"/>
            <median>
              <p1 x="1867.5" y="2319"/>
              <p2 x="1867.5" y="2377"/>
            </median>
          </barline>
        </inters>
        <relations/>
      </sig>
    </system>
  </page>
  <glyph-index>
    <glyph left="557" top="456" id="1">
      <run-table orientation="VERTICAL" width="6" height="60">
        <runs>0 1 18 4 1 2 10 1 11 4 1 4 1</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
        <runs>0 1 59</runs>
        <runs>0 1 18 3 12 1 25</runs>
      </run-table>
    </glyph>
    <glyph left="680" top="456" id="3">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="879" top="456" id="5">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>53</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="999" top="456" id="7">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>48 3 3</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1121" top="456" id="9">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1252" top="456" id="11">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1389" top="456" id="13">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1589" top="456" id="15">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>47 3 4</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1712" top="456" id="17">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>48 1 2</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 2 1 9 6 6 1 2 33</runs>
      </run-table>
    </glyph>
    <glyph left="1874" top="454" id="19">
      <run-table orientation="VERTICAL" width="5" height="61">
        <runs>0 1 60</runs>
        <runs>0 1 60</runs>
        <runs>61</runs>
        <runs>0 1 59</runs>
        <runs>0 2 58</runs>
      </run-table>
    </glyph>
    <glyph left="354" top="645" id="21">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>7 1 51</runs>
      </run-table>
    </glyph>
    <glyph left="536" top="645" id="23">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>24 2 33</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="648" top="645" id="25">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>58</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="717" top="634" id="27">
      <run-table orientation="VERTICAL" width="3" height="70">
        <runs>0 4 66</runs>
        <runs>0 2 68</runs>
        <runs>70</runs>
      </run-table>
    </glyph>
    <glyph left="839" top="644" id="29">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>46</runs>
        <runs>0 1 58</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>10 2 47</runs>
      </run-table>
    </glyph>
    <glyph left="956" top="644" id="31">
      <run-table orientation="VERTICAL" width="4" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>19 2 37</runs>
      </run-table>
    </glyph>
    <glyph left="1108" top="641" id="33">
      <run-table orientation="VERTICAL" width="3" height="54">
        <runs>0 2 34</runs>
        <runs>0 1 36 2 15</runs>
        <runs>36 3 15</runs>
      </run-table>
    </glyph>
    <glyph left="1153" top="643" id="35">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1270" top="642" id="37">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>0 10 2 2 10 4 8 1 23</runs>
        <runs>0 1 59</runs>
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="1461" top="642" id="39">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>10 3 25 3 7 7 2</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>6 3 51</runs>
      </run-table>
    </glyph>
    <glyph left="1609" top="642" id="41">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>32 4 2 3 19</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1759" top="642" id="43">
      <run-table orientation="VERTICAL" width="3" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1875" top="642" id="45">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 58</runs>
        <runs>0 14 1 4 5 2 32</runs>
      </run-table>
    </glyph>
    <glyph left="425" top="826" id="47">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="534" top="826" id="49">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>8 4 6 8 6 6 21</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="641" top="826" id="51">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>18 6 10 1 24</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="818" top="825" id="53">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="929" top="825" id="55">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>19 9 31</runs>
        <runs>10 3 1 14 8 2 21</runs>
      </run-table>
    </glyph>
    <glyph left="1039" top="825" id="57">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>59</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1145" top="825" id="59">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>12 1 12 1 34</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>48 1 3 3 1</runs>
      </run-table>
    </glyph>
    <glyph left="1343" top="823" id="61">
      <run-table orientation="VERTICAL" width="4" height="61">
        <runs>0 1 60</runs>
        <runs>0 1 60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="1405" top="825" id="63">
      <run-table orientation="VERTICAL" width="4" height="58">
        <runs>0 12 6 3 2 3 32</runs>
        <runs>54</runs>
        <runs>51</runs>
        <runs>0 5 26 1 4 5 1</runs>
      </run-table>
    </glyph>
    <glyph left="1454" top="825" id="65">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>58</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="1566" top="824" id="67">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>23 1 9 1 3 5 1 12 1 3 1</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1679" top="825" id="69">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>33 1 3 1 20</runs>
      </run-table>
    </glyph>
    <glyph left="1875" top="825" id="71">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="336" top="1009" id="73">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 2 1 10 1 2 1 2 5 1 11 2 13 1 7</runs>
      </run-table>
    </glyph>
    <glyph left="531" top="1007" id="75">
      <run-table orientation="VERTICAL" width="5" height="61">
        <runs>0 2 59</runs>
        <runs>0 1 60</runs>
        <runs>61</runs>
        <runs>0 1 60</runs>
        <runs>0 4 2 3 11 8 32</runs>
      </run-table>
    </glyph>
    <glyph left="639" top="1008" id="77">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="831" top="1008" id="79">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
        <runs>0 1 33 1 3 1 1 2 1 3 1 3 2 4 1</runs>
      </run-table>
    </glyph>
    <glyph left="991" top="1005" id="81">
      <run-table orientation="VERTICAL" width="3" height="67">
        <runs>0 2 65</runs>
        <runs>0 1 66</runs>
        <runs>66</runs>
      </run-table>
    </glyph>
    <glyph left="1035" top="1009" id="83">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>53 3 1</runs>
      </run-table>
    </glyph>
    <glyph left="1205" top="999" id="85">
      <run-table orientation="VERTICAL" width="4" height="70">
        <runs>0 7 41 3 1</runs>
        <runs>0 3 67</runs>
        <runs>0 1 69</runs>
        <runs>69</runs>
      </run-table>
    </glyph>
    <glyph left="1253" top="1009" id="87">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>7 1 15 1 35</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>38 3 1 8 1</runs>
      </run-table>
    </glyph>
    <glyph left="1463" top="1009" id="89">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>17 3 1 2 15 2 19</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1670" top="1009" id="91">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1874" top="1009" id="93">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>19 1 16 6 6 8 1</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="407" top="1200" id="95">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>32 1 3 2 14 1 6</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="567" top="1200" id="97">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>0 1 59</runs>
        <runs>0 1 59</runs>
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>0 4 1 3 2 2 48</runs>
      </run-table>
    </glyph>
    <glyph left="727" top="1200" id="99">
      <run-table orientation="VERTICAL" width="4" height="61">
        <runs>0 1 59</runs>
        <runs>61</runs>
        <runs>61</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="913" top="1201" id="101">
      <run-table orientation="VERTICAL" width="5" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>18 2 29 4 3</runs>
      </run-table>
    </glyph>
    <glyph left="1097" top="1201" id="103">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1298" top="1201" id="105">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>0 1 58</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1442" top="1198" id="107">
      <run-table orientation="VERTICAL" width="3" height="53">
        <runs>0 6 1 3 3 3 10 4 9 2 12</runs>
        <runs>0 1 52</runs>
        <runs>52</runs>
      </run-table>
    </glyph>
    <glyph left="1484" top="1201" id="109">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>59</runs>
        <runs>59</runs>
        <runs>60</runs>
        <runs>0 3 1 1 2 4 9 1 25 6 8</runs>
      </run-table>
    </glyph>
    <glyph left="1681" top="1201" id="111">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 3 1 2 3 4 1 3 1 1 2 2 13 2 10 4 8</runs>
      </run-table>
    </glyph>
    <glyph left="1874" top="1202" id="113">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>33 1 5 2 19</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="437" top="1395" id="115">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 3 1 9 1 9 14 2 20</runs>
      </run-table>
    </glyph>
    <glyph left="626" top="1395" id="117">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="816" top="1395" id="119">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>39 2 19</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1039" top="1395" id="121">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>38 2 1 1 1 2 1 1 1 2 10</runs>
      </run-table>
    </glyph>
    <glyph left="1186" top="1396" id="123">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1312" top="1396" id="125">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1471" top="1396" id="127">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 2 2 8 6 1 16 1 2 2 6 1 3 2 2 1 1</runs>
      </run-table>
    </glyph>
    <glyph left="1612" top="1396" id="129">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>25 2 1 3 1 5 9</runs>
        <runs>59</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1701" top="1396" id="131">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1787" top="1396" id="133">
      <run-table orientation="VERTICAL" width="3" height="60">
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="355" top="1581" id="135">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="472" top="1581" id="137">
      <run-table orientation="VERTICAL" width="3" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="497" top="1579" id="139">
      <run-table orientation="VERTICAL" width="4" height="52">
        <runs>0 2 1 4 42</runs>
        <runs>0 2 50</runs>
        <runs>0 1 51</runs>
        <runs>26 2 7 5 11</runs>
      </run-table>
    </glyph>
    <glyph left="593" top="1581" id="141">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="714" top="1581" id="143">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 1 58</runs>
      </run-table>
    </glyph>
    <glyph left="799" top="1581" id="145">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>0 1 48</runs>
      </run-table>
    </glyph>
    <glyph left="890" top="1582" id="147">
      <run-table orientation="VERTICAL" width="3" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>49 6 1 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="975" top="1582" id="149">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1060" top="1581" id="151">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>0 3 1 10 1 3 1 5 1 1 7 2 2 2 20</runs>
      </run-table>
    </glyph>
    <glyph left="1195" top="1582" id="153">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>12 1 6 2 1 5 8 1 23</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>6 2 27 6 1 3 1</runs>
      </run-table>
    </glyph>
    <glyph left="1332" top="1582" id="155">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1465" top="1582" id="157">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>6 5 21 1 2 6 7 8 1</runs>
      </run-table>
    </glyph>
    <glyph left="1600" top="1582" id="159">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>40 1 18</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 1 58</runs>
        <runs>0 3 2 1 40</runs>
      </run-table>
    </glyph>
    <glyph left="1735" top="1583" id="161">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>0 12 6 2 3 1 35</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 1 58</runs>
      </run-table>
    </glyph>
    <glyph left="1874" top="1583" id="163">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 1 58</runs>
        <runs>0 1 58</runs>
        <runs>0 2 56</runs>
      </run-table>
    </glyph>
    <glyph left="357" top="1741" id="165">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>0 1 58</runs>
        <runs>0 1 58</runs>
        <runs>0 1 58</runs>
      </run-table>
    </glyph>
    <glyph left="479" top="1741" id="167">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>59</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 12 8 1 38</runs>
      </run-table>
    </glyph>
    <glyph left="606" top="1741" id="169">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 1 58</runs>
        <runs>0 1 6 2 10 2 33 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="729" top="1742" id="171">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>48 2 9</runs>
      </run-table>
    </glyph>
    <glyph left="856" top="1742" id="173">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>6 3 11 2 12 1 3 1 20</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="987" top="1742" id="175">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>9 2 48</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1112" top="1743" id="177">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>59</runs>
        <runs>59</runs>
        <runs>60</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1241" top="1743" id="179">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>9 8 1 2 4 1 7 4 2 1 21</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1367" top="1744" id="181">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>37 1 1 1 6 9 1</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1498" top="1743" id="183">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>0 4 1 9 7 7 8 5 19</runs>
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="1622" top="1744" id="185">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>7 6 1 3 1 2 39</runs>
        <runs>0 1 58</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1755" top="1745" id="187">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1826" top="1743" id="189">
      <run-table orientation="VERTICAL" width="3" height="53">
        <runs>0 9 1 4 7 7 24</runs>
        <runs>0 2 51</runs>
        <runs>52</runs>
      </run-table>
    </glyph>
    <glyph left="1874" top="1745" id="191">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 1 57</runs>
      </run-table>
    </glyph>
    <glyph left="353" top="1913" id="193">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="462" top="1913" id="195">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="583" top="1913" id="197">
      <run-table orientation="VERTICAL" width="5" height="58">
        <runs>51 2 3</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>0 2 1 7 48</runs>
      </run-table>
    </glyph>
    <glyph left="712" top="1913" id="199">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>23 4 8 4 20</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="997" top="1913" id="201">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>33 1 3 5 1 3 1</runs>
      </run-table>
    </glyph>
    <glyph left="1177" top="1914" id="203">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>35 5 7</runs>
      </run-table>
    </glyph>
    <glyph left="1349" top="1915" id="205">
      <run-table orientation="VERTICAL" width="4" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="1517" top="1915" id="207">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1693" top="1916" id="209">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>0 3 2 5 11 6 9 2 21</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>54 1 2</runs>
      </run-table>
    </glyph>
    <glyph left="1873" top="1916" id="211">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
      </run-table>
    </glyph>
    <glyph left="428" top="2099" id="213">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 13 1 3 1 9 32</runs>
      </run-table>
    </glyph>
    <glyph left="613" top="2099" id="215">
      <run-table orientation="VERTICAL" width="4" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="793" top="2099" id="217">
      <run-table orientation="VERTICAL" width="4" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="960" top="2099" id="219">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>8 4 6 8 8 1 14 1 10</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
      </run-table>
    </glyph>
    <glyph left="1130" top="2099" id="221">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 1 53 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="1307" top="2099" id="223">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>0 13 47</runs>
      </run-table>
    </glyph>
    <glyph left="1496" top="2101" id="225">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 2 1 8 1 1 1 3 1 3 5 1 13 1 1 3 1 1 6 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="1690" top="2102" id="227">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>0 16 1 4 2 4 32</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>48 1 1 2 7</runs>
      </run-table>
    </glyph>
    <glyph left="1872" top="2103" id="229">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>19 2 4 1 23 1 10</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>0 1 57</runs>
      </run-table>
    </glyph>
    <glyph left="322" top="2313" id="231">
      <run-table orientation="VERTICAL" width="5" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>0 1 57</runs>
        <runs>0 3 1 3 2 4 1 3 1 3 12 1 24</runs>
      </run-table>
    </glyph>
    <glyph left="408" top="2313" id="233">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>59</runs>
        <runs>0 1 58</runs>
        <runs>0 1 57</runs>
        <runs>0 1 57</runs>
        <runs>0 1 57</runs>
      </run-table>
    </glyph>
    <glyph left="491" top="2313" id="235">
      <run-table orientation="VERTICAL" width="6" height="59">
        <runs>0 1 33 2 17 1 1</runs>
        <runs>0 1 58</runs>
        <runs>59</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>0 3 2 7 46</runs>
      </run-table>
    </glyph>
    <glyph left="653" top="2314" id="237">
      <run-table orientation="VERTICAL" width="4" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="738" top="2314" id="239">
      <run-table orientation="VERTICAL" width="5" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="822" top="2314" id="241">
      <run-table orientation="VERTICAL" width="5" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>20 3 10 5 13 3 1</runs>
      </run-table>
    </glyph>
    <glyph left="909" top="2314" id="243">
      <run-table orientation="VERTICAL" width="5" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>19 3 26 7 1</runs>
      </run-table>
    </glyph>
    <glyph left="1078" top="2314" id="245">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>23 2 8 1 1 1 3 1 6 2 11</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
      </run-table>
    </glyph>
    <glyph left="1199" top="2314" id="247">
      <run-table orientation="VERTICAL" width="6" height="59">
        <runs>8 1 50</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>38 7 1</runs>
      </run-table>
    </glyph>
    <glyph left="1360" top="2314" id="249">
      <run-table orientation="VERTICAL" width="5" height="60">
        <runs>0 1 59</runs>
        <runs>0 1 59</runs>
        <runs>60</runs>
        <runs>0 1 59</runs>
        <runs>0 1 34 2 12 7 1</runs>
      </run-table>
    </glyph>
    <glyph left="1477" top="2316" id="251">
      <run-table orientation="VERTICAL" width="4" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
      </run-table>
    </glyph>
    <glyph left="1631" top="2317" id="253">
      <run-table orientation="VERTICAL" width="5" height="59">
        <runs>0 8 10 4 26</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>59</runs>
        <runs>0 3 1 12 2 6 7 2 6 1 19</runs>
      </run-table>
    </glyph>
    <glyph left="1747" top="2318" id="255">
      <run-table orientation="VERTICAL" width="5" height="58">
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>58</runs>
        <runs>0 4 47 1 1 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="1860" top="2318" id="257">
      <run-table orientation="VERTICAL" width="15" height="60">
        <runs>59</runs>
        <runs>59</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>21 4 7 9 18</runs>
        <runs>21 3 35</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>60</runs>
        <runs>59</runs>
        <runs>0 1 58</runs>
        <runs>0 2 56</runs>
      </run-table>
    </glyph>
    <glyph left="188" top="454" id="259">
      <run-table orientation="HORIZONTAL" width="1688" height="7">
        <runs>0 1393 1</runs>
        <runs>0 87 1 1305 1 78 7 68 6 10 1 7 3 4 5 3 2 7 2 3 7 5 1 1 3 1 1 3 4 5 1 9 15 4 2 3 2 1 8</runs>
        <runs>0 2 2 3 3 1 3 7 3 3 1 25 1 30 4 6 1 5 4 13 3 4 2 56 1 18 1 20 1 17 1 95 1 180 1 34 1 6 1 3 2 90 2 4 3 5 1 1 1 3 1 8 1 31 1 16 3 7 1 3 4 8 24 4 1 3 1 5 5 2 7 4 6 4 72 2 15 3 16 5 13 2 3 4 33 18 53 4 57 18 58 4 5 1 12 8 42 16 29 16 28 16 23 5 62 1 10 2 42 5 16 3 10 1 74 9 44</runs>
        <runs>0 1 27 4 2 11 34 5 4 6 35 5 6 7 94 95 33 6 117 4 69 90 36 4 116 4 118 5 55 18 53 4 57 18 58 4 18 8 42 16 29 16 28 16 23 5 62 1 10 2 42 5 16 3 10 1 66 1 7 9 44</runs>
        <runs>28 4 2 11 34 5 4 6 35 5 6 7 94 95 33 6 117 4 69 90 36 4 116 4 118 5 55 18 53 4 31 1 25 18 36 1 17 2 2 4 1 1 2 3 11 8 32 1 9 16 2 1 10 5 5 5 1 16 1 4 4 12 5 1 1 16 3 4 2 3 9 1 1 5 1 1 2 4 8 47 6 41 2 4 1 5 1 22 6</runs>
        <runs>0 16 5 1 2 2 2 4 2 50 1 2 1 6 2 38 6 7 1 23 2 163 2 9 1 14 1 3 1 11 6 2 2 11 3 1 11 9 4 3 16 2 4 14 1 2 2 4 5 4 8 4 3 3 4 1 2 4 1 1 1 1 3 7 2 4 1 4 3 2 2 5 1 13 1 90 2 4 3 10 1 15 1 4 4 111 1 121 1 59 1 75 1 131 1 268 3</runs>
        <runs>0 134 2 1 3 196 1 159 1 158 1</runs>
      </run-table>
    </glyph>
    <glyph left="188" top="468" id="260">
      <run-table orientation="HORIZONTAL" width="1688" height="7">
        <runs>0 1629 1 16 1</runs>
        <runs>0 932 1 267 1 157 1 41 1 45 1 17 5 3 3 21 2 11 4 7 3 6 2 1 2 4 3 3 13 16 57 16 39</runs>
        <runs>0 79 1 59 1 192 1 3 1 96 1 130 1 3 1 3 3 32 2 3 1 38 1 4 1 275 1 5 1 124 1 5 1 129 2 4 1 26 1 5 1 48 1 15 3 8 1 17 1 15 4 5 2 16 5 2 2 4 6 2 5 5 49 9 5 3 51 6 28 16 57 16 39</runs>
        <runs>0 2 17 19 2 1 7 1 9 12 5 3 2 7 1 3 2 5 33 5 4 11 45 8 38 3 42 4 42 3 33 6 6 1 47 1 4 2 19 2 34 5 18 9 5 1 36 3 41 3 40 4 35 5 60 2 52 5 63 2 53 5 126 5 132 4 21 6 1 5 32 17 28 17 27 16 26 5 49 9 5 3 51 6 28 16 57 16 39</runs>
        <runs>0 1 18 19 28 4 10 7 6 5 34 4 4 11 45 8 38 3 42 4 42 3 33 6 59 2 55 5 19 8 42 3 41 3 40 4 35 5 60 2 52 5 63 2 53 5 126 5 132 4 21 6 1 5 32 17 28 17 27 16 26 5 38 2 9 9 5 3 51 6 1 2 3 2 4 2 3 6 1</runs>
        <runs>0 38 9 3 16 4 10 7 6 5 9 2 3 6 3 2 3 5 1 4 4 11 2 2 8 1 32 8 19 3 4 1 11 3 42 4 42 3 33 6 59 2 55 5 19 8 42 3 41 3 40 4 35 5 26 3 7 1 3 1 7 7 2 2 1 2 2 6 1 1 3 3 1 22 1 2 10 5 1 8 2 50 2 2 1 30 1 16 1 3 1 37 2 3 1 22 2 40 2 34 1 123 1 113 1 43 1 105 1</runs>
        <runs>0 136 1 2 1 105 1 90 1 40 2 4 10 6 5 5 10 3 7 3 2 2 3 2 5 1 2 23 2 14 1 7 1 4 1 66 1 39 1 3 1 34 1 3 1 37 2 67 1 118 1</runs>
      </run-table>
    </glyph>
    <glyph left="188" top="483" id="261">
      <run-table orientation="HORIZONTAL" width="1688" height="6">
        <runs>0 1458 3 92 1 30 1 6 5 1 2 1 1 4 80</runs>
        <runs>0 100 2 143 1 509 1 121 1 190 1 131 1 4 1 23 1 43 1 40 1 43 1 65 1 5 1 3 1 3 2 1 3 2 2 4 1 4 4 9 5 9 1 1 3 1 9 1 14 3 1 2 2 1 1 5 1 3 21 17 114</runs>
        <runs>0 2 10 11 2 22 19 3 4 7 14 4 4 6 18 3 5 13 50 7 1 5 32 3 42 4 42 4 32 6 58 4 54 6 19 14 35 3 41 3 40 3 36 4 61 3 52 4 63 3 52 5 126 4 53 7 14 14 19 7 19 4 25 4 36 3 42 3 41 3 39 5 47 4 4 9 54 5 25 17 114</runs>
        <runs>0 2 10 11 2 22 19 3 4 7 14 4 4 6 18 3 5 13 50 7 1 5 32 3 42 4 42 4 32 6 58 4 54 6 19 14 35 3 41 3 40 3 36 4 61 3 52 4 63 3 52 5 126 4 53 7 16 12 19 7 19 4 25 4 36 3 42 3 41 3 39 5 47 4 4 9 54 5 25 17 2 1 5 1 3 3 5 3 2 21 1</runs>
        <runs>0 10 2 35 19 3 4 7 14 4 4 6 18 3 5 13 50 7 1 5 32 3 42 4 42 4 32 6 58 4 54 6 19 14 35 3 41 3 40 3 36 4 61 3 52 4 8 1 20 1 23 1 9 3 4 1 11 3 5 1 20 1 6 5 5 4 1 2 2 10 2 4 3 12 6 8 11 1 7 12 3 13 2 6 6 1 1 1 3 4 4 1 9 8 3 25 1 9 9 1 6 55 2 4 1 2 3 2 4 12 1 39 1 3 1 10 2 2 3 1 3 15 2 1 2 3 1 1 2 36 1 3 1 89 1 70 1</runs>
        <runs>0 241 1 409 1 3 1 34 1 4 1 63 1 117 1 54 1 135 1 131 1 113 1</runs>
      </run-table>
    </glyph>
    <glyph left="188" top="496" id="262">
      <run-table orientation="HORIZONTAL" width="1688" height="8">
        <runs>0 1644 1 26 1</runs>
        <runs>0 1554 1 2 1 59 1 26 1 26 1 13 1</runs>
        <runs>0 11 1 189 1 43 1 213 1 350 1 4 1 61 1 2 1 51 1 5 1 81 1 25 2 20 1 74 1 12 3 11 1 29 1 34 1 33 1 3 1 40 1 3 1 6 2 31 1 13 1 27 1 18 11 1 22 4 15 2 50 5 26 2 47 13 14 13 14 13 15</runs>
        <runs>0 4 3 3 2 6 1 2 1 22 1 155 2 23 1 19 2 67 3 20 1 94 1 25 4 29 1 4 1 28 1 42 1 43 1 42 1 16 3 13 3 5 1 57 2 17 2 16 2 15 3 4 2 5 9 37 1 5 1 1 2 2 4 3 2 17 2 5 10 2 8 5 3 8 3 2 11 1 12 13 15 14 6 3 5 12 3 1 1 3 2 5 3 4 10 5 1 2 2 2 17 3 6 11 2 4 11 10 13 1 3 10 20 4 16 14 35 3 42 3 41 3 39 5 47 4 67 5 26 2 47 13 14 13 14 13 15</runs>
        <runs>0 2 10 6 4 6 6 4 7 6 43 8 28 6 2 10 54 4 20 19 26 20 26 20 32 6 58 5 54 4 25 4 25 18 27 17 26 17 36 5 60 4 51 4 63 2 53 5 40 13 15 14 14 12 18 4 48 11 17 10 17 10 20 4 16 14 35 3 42 3 41 3 39 5 47 4 67 5 22 1 3 2 15 1 3 2 1 4 3 85 1 13 1</runs>
        <runs>0 2 10 6 4 6 6 4 7 6 43 8 28 6 2 10 54 4 20 19 26 20 26 20 32 6 58 5 54 4 25 4 25 18 27 17 26 17 36 5 60 4 51 4 63 2 53 5 40 13 15 14 14 12 18 4 48 11 17 10 17 10 20 4 16 14 35 3 33 2 7 3 19 2 20 3 18 2 3 169 1 2 1</runs>
        <runs>0 38 1 90 1 95 1 44 1 26 4 15 1 58 1 10 2 16 1 25 3 7 1 5 2 6 3 1 2 2 3 16 3 7 1 4 1 43 1 36 1 77 1 159 1 61 1 2 1 51 1 135 1 92 4 5 1 29 1</runs>
        <runs>0 225 1 44 1 45 1 179 1 666 2</runs>
      </run-table>
    </glyph>
    <glyph left="188" top="511" id="263">
      <run-table orientation="HORIZONTAL" width="1688" height="7">
        <runs>0 1657 1 27 1</runs>
        <runs>0 136 2 10 3 885 1 81 1 101 1 302 2 4 1 7 2 15 1 3 13 1 32 3 24 3 24 3 25</runs>
        <runs>0 3 6 2 1 11 13 61 1 37 3 10 4 75 4 1 5 2 1 3 1 73 3 3 3 5 2 6 1 1 1 27 1 5 1 115 1 5 1 86 2 1 1 3 1 43 1 35 1 7 1 10 2 3 2 5 1 48 3 6 3 2 1 3 10 1 4 2 1 3 3 4 3 3 9 4 14 4 1 2 9 1 1 7 1 3 1 1 3 8 5 3 3 1 7 2 4 6 12 4 7 1 1 1 4 5 18 5 17 3 14 1 10 3 12 2 10 3 28 4 16 16 16 2 26 3 23 4 14 3 10 4 16 3 4 7 35 92 40 4 47 4 68 4 26 3 46 3 24 3 24 3 25</runs>
        <runs>0 1 20 2 13 8 94 10 222 5 44 8 2 9 54 5 51 18 26 17 27 17 39 3 49 6 6 4 52 4 48 8 5 3 53 5 18 5 17 3 25 3 24 3 28 4 16 16 16 2 26 3 23 4 14 2 11 4 16 3 4 7 35 92 40 4 47 4 68 4 26 3 46 3 24 3 2 4 4 4 6 1 3 3 2 2 13 2 2 2 1</runs>
        <runs>0 1 20 2 13 8 94 10 222 5 44 8 2 9 54 5 51 18 26 17 27 17 39 3 49 6 6 4 52 4 48 8 5 3 53 5 18 5 17 3 25 3 24 3 28 4 16 16 16 2 26 3 23 4 14 3 10 4 16 3 4 7 35 92 40 4 29 1 8 1 8 4 62 1 5 4 3 1 2 10 3 5 2 48 1</runs>
        <runs>0 35 1 73 2 237 2 68 1 67 2 144 1 117 3 2 1 116 2 2 1 3 2 95 1 31 1 26 1 63 1 17 1 101 1 333 1</runs>
        <runs>0 750 2 120 1 7 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="640" id="264">
      <run-table orientation="HORIZONTAL" width="1751" height="9">
        <runs>0 1689 2</runs>
        <runs>0 1685 1 1 4</runs>
        <runs>0 1001 1 85 4 80 1 6 4 2 7 2 4 3 2 3 2 3 1 27 5 7 1 19 1 4 4 6 1 27 1 1 15 2 3 5 30 16 97 4 47 5 93 4 25 1 7 1 9 1 2 3 6 11 34 1 12</runs>
        <runs>0 82 2 225 1 169 2 72 3 14 1 19 1 100 1 84 3 86 3 108 2 23 6 4 1 7 8 4 48 8 5 3 50 4 27 2 33 17 23 18 25 19 22 5 30 16 97 4 47 4 94 4 46 3 6 11 47</runs>
        <runs>0 26 1 4 1 13 1 29 1 4 4 27 1 100 12 85 2 79 2 59 3 23 4 60 2 1 3 2 1 3 4 7 9 16 2 40 1 37 2 20 9 11 2 6 23 2 4 2 16 10 3 4 12 1 4 1 5 1 15 2 6 4 65 17 24 17 25 19 26 4 48 8 5 3 50 4 27 2 33 17 23 18 25 19 22 5 30 16 97 4 47 4 94 4 3 2 38 6 6 11 47</runs>
        <runs>27 4 3 11 31 4 4 6 77 18 43 5 15 7 1 6 27 20 21 19 22 19 20 5 66 2 39 5 23 3 38 18 23 17 22 20 22 6 47 10 3 4 47 4 65 17 24 17 25 19 26 4 48 8 5 3 50 4 27 2 33 17 23 18 25 20 3 3 2 5 4</runs>
        <runs>0 1 26 4 3 11 31 4 4 6 77 18 43 5 15 7 1 6 27 20 21 19 22 19 20 5 66 2 39 5 23 3 38 18 23 17 22 20 22 6 47 10 3 4 25 2 2 2 11 1 4 4 5 12 1 9 11 15 1 10 1 18 2 62 1 44 1 60 1</runs>
        <runs>0 31 1 43 1 4 1 9 2 74 1 37 21 2 1 27 1 16 2 35 3 39 1 18 1 102 4 27 1 3 1 2 1 5 5 5 1 29 2 9 2 20 1 40 1 37 2 41 1</runs>
        <runs>0 206 7 157 1 102 3</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="655" id="265">
      <run-table orientation="HORIZONTAL" width="1751" height="7">
        <runs>0 1083 2 108 1 293 1 116 3 2 1 5 1 16 1 3 2 4 11 3 2 2 6 3 11 1 18 3 2 3 14 2 26</runs>
        <runs>0 1026 1 4 1 47 1 2 3 108 1 16 1 3 1 35 1 3 1 37 1 3 1 43 2 23 1 32 1 3 2 1 16 4 2 3 4 12 2 2 5 3 25 4 34 17 47 10 38 3 30 3 30 3 47</runs>
        <runs>0 80 1 172 1 336 1 91 1 83 1 3 2 57 1 104 1 41 1 8 1 17 20 2 2 4 45 3 6 7 52 5 25 19 18 3 37 3 39 3 39 5 26 17 51 11 38 4 34 17 47 10 38 3 30 3 30 3 47</runs>
        <runs>0 62 1 17 1 146 1 5 1 19 1 4 1 34 1 35 1 44 1 40 1 63 1 91 1 18 1 3 1 36 1 4 1 37 1 2 13 1 1 5 2 3 1 6 4 5 2 2 4 9 1 4 1 1 7 6 7 1 1 2 6 8 17 2 3 1 27 4 23 19 23 4 37 4 38 3 42 4 45 3 6 7 52 5 25 19 18 3 37 3 39 3 39 5 26 17 51 11 38 4 34 17 47 10 38 3 30 3 30 3 47</runs>
        <runs>0 1 17 21 24 4 10 3 1 2 7 4 134 5 21 4 31 4 37 4 37 3 36 5 45 9 1 9 43 5 24 20 20 3 38 4 34 4 39 5 46 2 6 8 50 4 23 19 23 4 37 4 38 3 42 4 29 5 4 1 6 3 6 8 1 11 3 3 24 3 4 1 1 5 7 7 3 27 1 16 1 3 2 9 6 19 1 3 2 36 1 3 1 335 1 115 1</runs>
        <runs>0 1 17 21 24 4 10 3 1 2 7 4 134 5 21 4 31 4 37 4 37 3 36 5 45 9 1 9 43 5 24 20 20 3 38 4 34 4 39 5 46 2 6 8 33 2 15 4 23 19 1 4 13 4 1 4 14 2 15 10 3 10 1 5 3 3 3 2 1 6 1 3 3 3 2 1 1 1 2</runs>
        <runs>0 89 1 4 1 138 1 59 2 34 1 40 1 3 1 40 1 43 1 19 1 41 1 5 1 62 1 3 1 36 1 42 1 88 1 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="669" id="266">
      <run-table orientation="HORIZONTAL" width="1751" height="8">
        <runs>0 1670 1 2 1 2 1 54 4 1 2 8 3</runs>
        <runs>0 1076 1 137 1 125 1 28 2 36 1 22 1 34 1 14 3 4 1 3 8 1 7 2 5 4 1 19 1 13 3 1 3 1 1 2 6 1 6 4 1 10 3 2 36 5 28 5 4 2 7 19 47</runs>
        <runs>0 77 1 19 1 456 1 208 1 2 1 10 2 35 1 13 1 5 4 3 1 4 11 3 39 4 21 4 12 4 11 2 25 3 42 4 13 1 32 2 65 5 25 4 33 3 37 3 39 3 39 5 26 3 62 9 43 4 20 2 10 19 43 10 41 5 28 5 4 2 7 19 47</runs>
        <runs>0 8 3 12 2 52 1 16 4 129 1 101 1 3 1 36 1 3 1 34 1 5 2 2 5 10 1 2 1 18 4 3 4 25 3 23 4 5 2 3 1 8 1 5 4 3 2 3 1 2 2 2 1 3 3 5 1 2 10 3 5 1 2 1 4 13 2 2 4 3 1 4 11 6 2 1 14 4 39 5 46 2 63 5 23 3 39 4 37 4 38 3 42 4 46 2 65 5 25 4 33 3 37 3 39 3 39 5 26 3 62 9 43 4 20 2 10 19 43 10 35 1 5 5 13 9 3 2 1 7 2 2 1 3 3 19 18 1 5 1 1 3 18</runs>
        <runs>0 2 9 12 2 21 17 4 2 8 10 2 1 4 4 6 26 1 36 7 4 1 8 8 14 8 11 5 15 3 16 1 3 1 17 4 37 3 38 3 36 5 45 3 59 5 24 3 37 3 38 4 34 4 39 5 46 2 63 5 23 3 39 4 37 4 38 3 42 4 30 1 15 2 4 1 22 1 3 1 30 1 2 5 5 1 6 1 1 1 5 1 4 4 3 1 13 1 3 1 11 3 2 1 7 1 24 1 1 3 2 1 12 2 22 3 38 6 18 2 4 1 1 3 2 1 21 2 2 12 2 7 3 68 1 186 1 5 1 65 1</runs>
        <runs>0 2 9 12 2 21 17 4 2 8 13 4 4 6 63 7 13 8 14 8 11 5 56 4 37 3 38 3 36 5 45 3 59 5 24 3 37 3 38 4 34 4 39 5 5 3 1 5 6 6 4 2 3 1 3 2 1 2 2 2 9 4 2 2 1 1 4 2 5 3 3 14 2 10 1 5 1 21 1 174 1 44 1</runs>
        <runs>0 10 1 13 1 37 1 14 4 13 4 6 1 22 5 6 4 8 4 20 1 4 2 45 2 5 2 10 16 3 1 3 2 2 6 2 9 4 37 3 38 3 16 2 2 3 2 16 3 2 2 2 3 10 2 2 7 7 5 3 2 3 1 5 4 3 1 13 3 1 1 8 2 3 3 5 1 5 3 20 1 3 2 32 3 3 1 2 2 32 1 37 1 4 1 43 1 115 1 21 1</runs>
        <runs>0 10 1 216 1 366 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="683" id="267">
      <run-table orientation="HORIZONTAL" width="1751" height="8">
        <runs>0 1632 1 43 1 21 1</runs>
        <runs>0 1076 1 133 1 121 3 5 1 56 2 5 2 4 3 3 1 6 7 7 1 7 3 2 1 2 30 4 10 15 10 16 41 10 2 4 38 4 29 10 23 3 47</runs>
        <runs>0 903 1 81 1 45 1 15 4 7 9 7 3 2 2 1 8 5 2 8 4 8 6 7 1 9 4 11 3 7 9 4 33 3 15 2 20 4 6 1 3 31 39 5 26 4 60 7 5 3 38 4 10 15 10 16 41 10 2 4 38 4 29 10 23 3 47</runs>
        <runs>0 10 1 10 1 182 1 221 1 32 1 3 1 86 1 3 1 35 1 83 1 1 2 34 1 10 2 3 1 1 5 4 1 3 9 2 10 2 2 2 15 2 1 1 40 6 22 3 39 4 37 10 1 34 41 5 46 2 65 5 25 4 33 3 37 4 10 31 39 5 26 4 60 7 5 3 38 4 10 15 10 16 41 10 2 4 38 4 29 10 23 3 47</runs>
        <runs>0 2 9 7 4 5 7 4 6 6 40 8 65 10 9 10 13 9 13 6 13 13 30 85 36 5 45 3 59 5 24 3 37 3 34 46 39 6 45 2 63 6 22 3 39 4 37 10 1 34 41 5 46 2 65 5 25 4 33 3 37 4 10 31 5 2 7 3 3 1 6 1 1 4 3 2 1 5 1 29 2 14 1 3 1 96 1 8 1 135 1 43 1</runs>
        <runs>0 1 10 7 4 5 7 4 6 6 40 8 65 10 9 10 13 9 13 6 13 13 30 85 36 5 45 3 59 5 24 3 37 3 34 46 39 6 45 2 63 6 9 3 3 5 2 3 2 3 8 5 1 5 4 4 1 5 1 4 2 80 1 90 1</runs>
        <runs>0 2 4 1 4 7 4 5 7 4 6 6 5 1 34 8 65 10 9 10 1 5 7 9 3 1 9 6 13 13 30 85 36 5 45 3 59 5 3 1 1 1 5 1 3 6 3 3 17 2 7 1 10 3 2 5 18 3 6 46 2 1 7 25 4 11 2 6 1 30 1 2 1 89 1 128 1</runs>
        <runs>0 374 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="698" id="268">
      <run-table orientation="HORIZONTAL" width="1751" height="7">
        <runs>0 1340 1 25 1 115 1 12 1 42 2 28 6 7 7 5 4 4 2 6 2 2 3 4 13 3 49 19 45</runs>
        <runs>0 23 1 1052 1 66 1 131 2 49 3 2 5 4 3 4 8 1 2 1 8 3 5 1 5 5 6 1 90 4 10 15 7 19 95 3 49 17 47</runs>
        <runs>0 23 6 5 1 127 1 35 1 205 2 21 1 31 1 3 4 54 1 5 1 16 2 4 1 90 1 3 4 2 6 5 29 9 2 2 10 4 46 2 64 4 23 85 84 5 46 2 65 5 25 83 79 4 27 3 113 4 10 15 7 19 95 3 46 1 2 17 47</runs>
        <runs>0 1 19 3 12 9 5 12 1 16 2 11 3 6 6 5 8 2 1 9 23 3 6 2 8 2 7 3 19 4 19 6 13 3 4 7 37 1 45 3 44 4 16 5 45 3 59 5 24 85 2 3 1 1 71 4 46 2 64 4 23 85 84 5 46 2 65 5 25 83 79 4 27 3 84 3 17 4 2 1 2 4 5 1 1 1 2 15 4 22 3 1 14 4 3 1 3 4 1 1 1 3 2 1 2 10 2 2 2 142 9</runs>
        <runs>0 1 19 3 12 9 79 5 35 2 17 3 19 4 19 6 13 3 4 7 150 5 45 3 59 5 24 85 2 3 1 1 71 4 38 2 6 2 7 4 2 5 3 1 11 2 6 18 2 28 2 179 1 66 1 2 1 19 1 8 1 2 1 30 1 88 1 6 1 2 1</runs>
        <runs>0 2 4 11 3 3 12 11 5 1 1 1 7 1 4 4 2 3 5 4 3 1 6 5 6 4 3 5 1 14 4 3 3 20 1 2 2 6 2 5 2 3 2 15 2 4 2 4 4 6 3 6 1 5 1 1 5 3 4 7 6 1 2 1 1 1 9 1 15 1 58 1 29 1 5 14 1 20 2 8 1 4 3 3 5 6 1 3 1 9 5 4 2 3 6 11 2 15 1 9 3 3 2 4 2 5 1 100 1</runs>
        <runs>0 18 2 14 1 214 1 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="823" id="269">
      <run-table orientation="HORIZONTAL" width="1750" height="7">
        <runs>0 1589 1 113 2</runs>
        <runs>0 1221 1 204 2 4 2 154 2 3 1 35 1 3 1 35 1 32 3 6 1 2 1</runs>
        <runs>0 82 3 98 1 483 2 38 1 33 3 6 3 49 1 7 3 3 1 5 2 4 1 2 2 10 1 3 1 6 5 1 1 2 1 2 1 1 2 7 3 4 2 2 4 4 8 8 1 4 1 2 2 2 1 2 3 1 2 1 8 2 4 3 2 4 5 3 9 4 4 4 4 1 6 1 9 2 2 2 6 5 5 2 28 127 31 4 59 2 46 4 59 3 46 5 61 3 43 5 33 3 37 3 37 4 38 2 35</runs>
        <runs>30 4 2 11 30 4 4 7 9 1 10 1 8 6 57 86 29 4 56 3 46 5 59 3 40 5 58 85 29 4 58 3 46 5 56 2 47 4 58 3 41 5 35 127 31 4 59 2 46 4 59 3 46 5 61 3 43 5 33 3 37 3 37 4 38 2 35</runs>
        <runs>30 4 2 11 30 4 4 7 92 86 29 4 56 3 46 5 59 3 40 5 58 85 29 4 58 3 6 1 39 5 41 2 13 2 3 2 1 2 19 2 1 3 6 1 1 3 3 4 4 1 19 3 6 4 7 4 10 3 8 4 1 8 4 9 7 5 1 6 7 1 2 7 2 2 3 3 1 127 1 34 1 105 1 4 1 176 1 79 1 3 1 117 1 2 1 7 1 11 6 2 7</runs>
        <runs>0 1 29 4 2 11 30 4 4 7 92 86 29 4 56 3 46 5 11 3 6 6 12 3 3 7 8 3 5 2 33 5 15 5 6 5 15 1 11 85 19 8 2 4 1 56 1 109 1 53 1 303 1 526 1</runs>
        <runs>0 183 1 86 1 32 1 387 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="837" id="270">
      <run-table orientation="HORIZONTAL" width="1750" height="7">
        <runs>0 1629 1</runs>
        <runs>0 619 1 38 1 32 1 4 1 56 1 53 1 58 1 45 1 4 1 106 1 33 1 3 1 4 2 32 1 38 1 41 1 38 1 65 1 39 1 4 1 49 5 3 1 3 1 24 2 6 5 2 1 1 4 5 7 25 4 12 3 1 2 2 1 1 3 3 2 41 1 4 1 35 1 32 4 3 1 80 1 33 1</runs>
        <runs>0 62 1 4 1 9 1 101 1 80 1 2 4 31 1 5 1 16 1 6 1 8 2 2 4 2 3 2 2 1 4 4 1 2 1 5 8 4 15 2 7 5 6 3 26 2 22 3 40 5 14 8 7 1 15 1 13 3 38 3 36 3 30 4 58 3 46 4 56 3 47 4 58 3 41 5 35 3 36 3 40 3 39 3 31 4 58 4 45 4 59 3 46 5 61 3 44 4 32 4 37 3 24 17 24 16 35</runs>
        <runs>0 1 19 20 2 4 6 4 4 2 1 4 11 6 6 5 4 1 2 4 1 4 1 13 1 7 5 1 2 7 36 3 8 2 28 3 39 3 29 5 55 4 45 5 59 3 40 5 14 8 7 1 29 3 38 3 36 3 30 4 58 3 46 4 56 3 47 4 58 3 41 5 35 3 36 3 40 3 39 3 31 4 58 4 45 4 59 3 46 5 61 3 44 4 32 4 37 3 24 17 24 16 35</runs>
        <runs>20 20 23 4 11 6 6 5 46 7 36 3 38 3 39 3 29 5 55 4 45 5 59 3 40 5 14 8 7 1 29 3 38 3 36 3 30 4 58 3 46 4 56 3 47 4 58 3 41 5 35 3 36 3 7 1 4 1 1 1 5 8 5 6 1 3 4 5 3 15 3 3 2 2 2 3 1 9 1 3 4 2 3 1 2 2 3 4 2 21 5 2 3 14 2 8 1 4 1 41 3 62 1 3 1 50 1 63 1 42 1 4 1 35 1 35 1 3 1 80 7 2 2 2 22</runs>
        <runs>0 2 7 5 2 24 12 4 1 1 5 4 2 2 7 6 1 1 4 5 3 1 15 4 21 1 1 7 5 1 14 3 1 1 11 3 38 3 1 4 2 2 4 2 1 2 3 5 1 5 1 5 1 7 1 4 11 3 3 2 1 5 2 14 12 81 1 57 1 3 1 25 1 2 3 13 1 98 1 42 1 28 1 4 1 215 1 4 1 149 1 33 1 119 1</runs>
        <runs>0 62 1 26 1 93 1 44 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="851" id="271">
      <run-table orientation="HORIZONTAL" width="1750" height="8">
        <runs>0 1221 1 168 1 114 1 83 1</runs>
        <runs>0 802 1 59 1 54 1 106 1 33 1 3 1 81 1 76 2 35 1 10 10 4 1 5 2 1 2 7 1 6 2 3 2 10 3 4 2 5 2 2 2 5 1 6 1 2 2 3 26 3 12 2 25 1 6 5 4 2 1 1 53 3 19 3 15 1 1 2 3 4 1 3 12 2 2 1 12 3 5 2 1 1 4 1 2 2 3 3 10 2 1 3 2 9 3 1 1 1 2 1 1 16 1 9 1 59 3 4 2</runs>
        <runs>0 77 1 19 1 150 2 112 1 44 1 30 1 7 1 24 1 3 1 5 1 2 1 29 1 5 1 9 1 51 1 107 2 4 2 52 4 3 1 44 1 51 9 3 2 9 3 7 2 22 2 4 8 19 2 27 2 3 2 3 3 8 2 1 7 7 3 1 4 5 35 3 2 1 20 17 25 17 25 17 31 4 58 4 45 4 59 3 46 5 61 3 44 4 33 3 37 3 21 16 25 17 37</runs>
        <runs>12 12 1 22 16 4 2 8 13 4 4 7 38 12 14 18 23 19 24 17 29 5 55 3 46 5 59 3 40 5 15 14 15 18 24 18 21 18 29 4 58 3 46 5 55 3 47 4 58 3 41 5 35 3 23 17 25 17 25 17 31 4 58 4 45 4 59 3 46 5 61 3 44 4 33 3 37 3 21 16 25 17 37</runs>
        <runs>12 12 1 22 16 4 2 8 13 4 4 7 38 12 14 18 23 19 24 17 29 5 55 3 46 5 59 3 40 5 15 14 15 18 24 18 21 18 29 4 58 3 46 5 55 3 47 4 58 3 41 5 35 3 21 19 4 2 6 5 1 24 1 47 3 6 4 16 1 14 6 85 1 4 1 57 1 114 1 46 1 4 1 31 1 3 1 35 1 3 1 40 3 10 1 3 4 17 2 4 31</runs>
        <runs>0 1 11 12 1 22 12 2 2 4 2 8 13 4 4 7 38 12 14 18 23 19 6 3 1 9 5 17 1 3 25 5 10 1 7 4 2 2 5 27 2 2 2 20 1 18 1 5 1 6 2 41 4 2 3 3 1 38 1 5 1 61 1 9 1 86 1 11 1 4 1 220 1 144 1 566 1 118 1</runs>
        <runs>0 94 4 97 1 500 1</runs>
        <runs>0 94 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="865" id="272">
      <run-table orientation="HORIZONTAL" width="1751" height="7">
        <runs>0 96 1</runs>
        <runs>0 95 2 51 1 548 1 220 1 303 1 52 3 5 1 44 1 56 7 3 1 36 1 8 1 4 1 14 2 7 2 28 3 55 1 30 2 43 1 24 2</runs>
        <runs>0 12 1 9 1 12 1 59 2 51 1 101 1 48 1 4 1 50 3 1 1 3 1 28 1 21 1 52 5 4 1 16 1 6 1 13 2 5 1 5 1 6 1 3 4 4 1 55 3 16 1 6 3 8 3 1 1 16 1 10 1 6 3 1 2 1 2 3 3 4 8 1 4 1 9 1 10 2 3 4 1 8 6 3 13 1 1 4 26 6 22 1 4 1 13 7 6 4 47 4 36 1 8 7 6 3 41 5 35 3 20 16 27 16 25 16 35 4 45 6 7 3 46 4 45 7 7 3 47 4 46 8 6 4 43 5 33 3 21 19 116</runs>
        <runs>0 1 12 6 4 6 7 4 6 6 7 3 1 1 1 2 15 2 1 10 2 3 6 7 36 3 16 17 25 16 25 17 32 4 43 7 6 3 46 5 45 8 5 4 40 5 21 4 17 17 25 16 23 16 33 4 44 8 6 3 45 6 41 7 6 4 47 4 45 7 6 3 41 5 35 3 20 16 27 16 25 16 35 4 45 6 7 3 46 4 45 7 7 3 47 4 46 8 6 4 43 5 33 3 21 19 116</runs>
        <runs>13 6 4 6 7 4 6 6 39 4 2 3 49 3 16 17 25 16 25 17 32 4 43 7 6 3 46 5 45 8 5 4 40 5 21 4 17 17 25 16 23 16 33 4 44 8 6 3 45 6 41 7 6 4 47 4 45 7 6 3 41 5 35 3 20 16 27 16 25 16 35 4 24 1 17 2 1 6 7 3 3 1 7 5 30 4 5 5 2 1 4 9 3 2 2 3 2 2 1 11 7 3 3 6 2 12 2 4 6 1 2 3 1 3 2 4 2 7 1 9 7 3 3 5 3 2 3 9 6 5 1 8 2 5 1 6 2 6 5 11 2 4 27 3 19 1 1 19 116</runs>
        <runs>0 19 3 7 3 3 1 4 6 6 1 8 3 31 1 6 3 6 1 2 4 28 3 36 4 3 14 1 3 16 1 42 3 11 1 15 1 4 1 8 3 38 3 2 1 54 1 43 1 8 5 4 1 38 1 5 1 170 1 4 1 51 2 3 1 94 1 7 2 3 1 50 1 4 1 51 3 2 1 297 2 110 2 4 1 108 1 248 1</runs>
        <runs>0 299 1 167 2 280 1 107 1 112 2 301 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="879" id="273">
      <run-table orientation="HORIZONTAL" width="1751" height="7">
        <runs>0 856 1 415 1 110 2 56 1 55 1</runs>
        <runs>0 352 1 111 3 274 1 4 1 107 3 56 1 53 2 55 1 197 1 44 1 2 3 60 1 44 7 7 1 2 1 10 1 3 5 2 1 9 2 6 7 4 1 16 3 12 1 7 4 3 5 9 1 29 2 10 5 4 1 2 1 6 1 25 1 35 2 16 4 97 1</runs>
        <runs>0 304 1 42 1 2 3 55 1 50 1 3 4 48 1 5 1 10 1 159 1 48 2 2 2 56 1 42 1 3 7 7 1 48 1 4 1 4 2 27 1 9 7 7 2 21 4 1 2 6 2 2 4 4 2 37 15 2 5 1 95 2 35 4 42 3 6 8 48 4 44 1 7 7 50 4 44 3 5 9 47 4 17 19 129 4 2 1 2 6 3 2 1 1 1 2 2</runs>
        <runs>0 1 1 23 7 3 2 8 1 252 2 4 5 21 14 3 6 7 6 3 6 2 15 3 14 5 2 2 19 1 19 2 8 7 4 2 22 1 8 3 2 5 17 2 17 1 22 1 10 1 5 1 95 5 41 2 6 8 49 5 38 3 7 7 50 4 42 2 7 7 44 4 19 20 155 4 42 3 6 8 48 4 44 1 7 7 50 4 44 3 5 9 47 4 17 19 156</runs>
        <runs>21 4 12 8 255 4 40 3 6 7 49 5 43 2 8 7 42 5 172 5 41 2 6 8 49 5 38 3 7 7 46 2 2 4 42 2 7 7 44 4 19 20 147 1 4 1 2 4 3 1 3 2 6 5 3 10 3 1 1 2 1 4 2 1 3 13 2 71 2 8 4 7 4 15 2 24 1 15 1 37 1 4 6 3 5 11 2 1 2 4 2 19 1 3 2 6 3 8 6 2 1 23 156</runs>
        <runs>0 1 20 4 12 8 255 4 40 3 6 7 49 5 43 2 8 7 42 5 172 5 41 2 6 8 21 2 3 6 1 3 2 4 3 32 2 7 1 10 3 9 5 10 4 8 1 3 13 10 1 1 1 2 4 5 3 4 2 4 15 5 4 7 4 20 1 16 3 716 2 3 9</runs>
        <runs>0 36 1 144 3 11 1 16 3 37 1</runs>
      </run-table>
    </glyph>
    <glyph left="166" top="1007" id="274">
      <run-table orientation="HORIZONTAL" width="1710" height="6">
        <runs>0 43 2 198 3 503 1 94 1 481 1 131 1 69 1</runs>
        <runs>0 5 1 30 1 3 5 138 3 20 3 3 2 6 4 14 13 1 4 6 1 9 5 4 6 4 5 1 3 1 15 8 9 3 2 11 2 18 8 3 2 37 8 68 5 51 2 21 3 18 7 1 4 65 2 4 2 10 2 20 1 36 2 73 1 19 2 332 1 108 1 35 1 2 2 36 3 90 2 12 2 54 2 2 1</runs>
        <runs>0 5 32 3 5 5 120 4 191 4 104 4 149 18 20 6 25 17 35 2 76 19 25 4 23 20 17 12 6 17 29 17 25 18 30 5 21 18 28 19 24 20 26 4 45 4 23 2 41 17 27 17 31 3 42 4 21 2 41 2 43 3 42 3 43</runs>
        <runs>0 5 14 3 15 3 5 5 120 4 191 4 104 4 31 2 116 18 20 6 25 17 35 2 76 19 25 4 23 20 17 12 6 17 29 17 25 18 30 5 21 18 28 19 24 20 26 4 45 4 23 2 41 17 27 17 31 3 42 4 21 2 41 2 43 3 42 3 43</runs>
        <runs>0 50 1 123 1 11 1 3 6 21 1 30 5 111 1 4 1 32 2 194 3 24 1 44 1 41 1 131 1 23 1 4 1 21 1 49 1 22 1 49 3 137 1 164 1 2 1 131 1 44 1 4 1 19 1 2 2 13 2 2 6 8 1 5 2 2 1 5 12 2 2 1 1 7 3 5 1 1 2 3 1 9 2 2 1 1 11 3 12 3 3 1 39</runs>
        <runs>0 251 1 112 1 4 1 1161 1 39 1 2 1 131 2</runs>
      </run-table>
    </glyph>
    <glyph left="166" top="1021" id="275">
      <run-table orientation="HORIZONTAL" width="1710" height="6">
        <runs>0 187 1 1113 1 156 1</runs>
        <runs>3 9 3 3 2 3 1 3 1 9 1 13 1 4 1 6 4 2 4 7 1 2 6 2 4 15 7 3 1 9 1 38 1 4 1 5 1 2 1 3 5 3 125 20 24 6 42 8 1 10 23 6 4 13 3 6 1 2 14 18 23 17 19 2 5 16 1 1 18 18 4 2 17 6 20 1 1 18 7 9 2 5 2 1 1 20 1 4 4 1 1 3 1 6 3 19 4 4 2 3 2 7 3 6 2 1 3 7 3 2 1 3 1 2 8 2 3 4 4 1 3 4 4 5 2 3 1 1 14 2 6 2 3 4 1 14 2 17 1 1 1 8 17 17 1 3 5 4 1 1 1 3 3 5 1 4 3 2 39 5 12 5 4 2 5 1 7 1 4 5 1 4 9 2 4 3 2 1 3 2 33 4 42 4 10 1 34 4 23 2 41 3 41 3 45 3 4 3 15 7 5 1 7 5 3 2 3 5 2 2 2 3 1 39 1</runs>
        <runs>24 3 11 6 8 4 48 6 7 3 50 4 10 3 5 3 125 20 24 6 42 8 2 9 41 5 26 18 23 17 26 16 20 18 23 6 22 18 27 20 24 19 25 3 41 4 23 3 34 12 4 17 28 17 28 4 44 5 21 2 43 3 41 4 42 4 45 4 23 2 41 3 41 3 45 3 42 5 19 3 41 3 42 3 42 3 43</runs>
        <runs>24 3 11 6 8 4 48 6 7 3 50 4 10 3 5 3 125 20 24 6 42 8 2 9 41 5 26 18 23 17 26 16 20 18 23 6 22 18 27 20 24 19 25 3 41 4 23 3 34 12 4 17 28 17 28 4 44 5 21 2 43 3 41 4 42 4 45 4 23 2 39 1 1 3 41 3 45 3 42 5 19 3 41 3 42 3 42 3 43</runs>
        <runs>0 27 1 23 1 4 1 53 4 60 1 8 1 3 1 25 2 104 1 371 1 44 1 43 1 43 1 43 1 4 1 21 1 3 1 48 1 163 1 2 1 41 1 3 1 39 1 99 1 21 1 2 1 43 1 39 1 47 1 50 1 21 1 39 1 3 3 20 2 16 1 3 1 2 4 8 3 4 2 2 2 1 2 1 7 2 1 3 2 1 3 2 5 3 1 2 24</runs>
        <runs>0 110 2</runs>
      </run-table>
    </glyph>
    <glyph left="166" top="1035" id="276">
      <run-table orientation="HORIZONTAL" width="1710" height="6">
        <runs>0 104 1 4 1 108 1 17 2 854 1</runs>
        <runs>0 24 1 2 1 30 2 44 6 65 1 7 1 11 1 22 2 14 4 62 2 17 1 15 3 1 6 1 2 10 1 2 1 1 1 6 4 1 2 3 4 26 1 4 1 27 2 11 1 3 1 4 2 4 1 5 1 22 1 39 1 68 1 17 1 6 1 29 1 26 1 132 1 48 1 66 1 36 2 14 1 3 1 45 2 47 1 18 2 3 3 19 2 17 1 3 1 8 5 14 2 10 1 46 1 52 1 21 1 2 1 33 7 9 2 16 2 14 1 47 1 50 1 18 1</runs>
        <runs>0 4 15 1 5 2 1 10 1 1 1 1 4 5 1 4 4 7 34 3 6 7 1 11 3 1 6 1 19 1 10 5 9 3 1 1 2 4 4 19 20 21 21 20 20 3 41 6 41 4 13 1 43 5 24 17 23 18 25 17 22 4 38 5 22 3 41 3 7 2 32 4 41 3 41 4 23 3 42 4 3 4 42 3 42 4 44 5 21 3 42 3 41 4 43 3 45 4 23 2 41 3 41 3 45 3 42 5 20 178 1</runs>
        <runs>0 4 21 2 1 10 14 4 4 7 34 3 6 7 53 5 9 3 4 4 4 19 20 21 21 20 20 3 41 6 41 4 57 5 24 17 23 18 25 17 22 4 38 5 22 3 41 3 41 4 41 3 41 4 23 3 42 4 3 4 42 3 42 4 44 5 21 3 42 3 41 4 43 3 45 4 23 2 41 3 41 3 45 3 42 5 20 136 43</runs>
        <runs>0 22 3 2 1 17 1 5 1 4 1 2 1 39 2 3 3 2 1 10 7 3 2 8 5 4 3 16 2 5 1 7 1 3 4 4 1 2 1 19 12 73 2 3 1 4 7 3 4 2 5 5 1 11 1 4 3 39 3 4 2 8 2 3 12 2 38 5 24 17 13 2 8 18 3 2 1 4 15 17 22 4 38 5 6 3 1 4 8 3 41 3 18 2 5 2 3 2 3 4 2 4 3 3 9 3 3 2 7 9 2 3 5 1 5 2 2 2 3 8 2 6 5 4 2 2 7 2 5 3 2 3 16 1 25 4 3 4 28 4 5 4 1 3 36 3 3 4 11 1 2 4 3 2 3 17 1 5 3 17 1 3 6 3 1 3 19 9 1 3 3 1 5 2 4 5 3 1 2 6 2 6 1 4 14 3 2 8 1 1 1 12 1 3 5 4 2 2 2 1 1 32 1 21 1 2 1 23 1 8 3 4 1 3 1 10 6 2 1 3 9 2 2 4 1 3 45 3 42 5 20 136 43</runs>
        <runs>0 183 1 316 1 957 1 69 1 157 1 19 2</runs>
      </run-table>
    </glyph>
    <glyph left="166" top="1049" id="277">
      <run-table orientation="HORIZONTAL" width="1710" height="6">
        <runs>0 56 1</runs>
        <runs>0 8 1 43 1 2 2 112 1 5 2 21 1 3 1 5 5 2 6 21 2 6 10 5 2 1 2 2 2 5 1 3 1 3 6 2 4 2 2 1 4 15 5 2 35 5 12 2 6 1 1 1 13 2 3 4 1 37 2 2 2 5 1 13 1 4 3 2 3 7 2 4 1 4 1 2 7 7 1 17 1 9 1 2 1 6 3 1 1 14 1 3 4 2 3 15 1 1 1 13 10 10 4 2 3 1 2 10 1 4 1 13 1 1 2 3 3 1 5 17 2 12 1 3 1 8 1 75 1 3 1 29 1 9 1 4 1 25 1 2 3 88 1 3 1 4 1 27 2 7 1 3 1 21 1 5 5 15 1 5 1 14 1 169 1 5 5 3 1 4 4 5 3 1 3 3 4</runs>
        <runs>0 8 20 1 3 3 12 2 4 2 2 3 41 3 16 1 49 5 15 5 4 3 36 4 38 3 37 3 42 5 41 4 58 5 22 4 37 3 40 3 36 4 37 5 23 3 41 3 41 4 41 3 41 4 23 3 49 4 42 3 43 3 44 4 22 139 45 4 23 138 42 5 22 2 9 1 2 4 7 2 1 2 3 4 1 8 2 17 3 11 1 69 1 26 1</runs>
        <runs>0 8 45 2 2 3 41 3 66 5 15 5 4 3 36 4 38 3 37 3 42 5 41 4 58 5 22 4 37 3 40 3 36 4 37 5 23 3 41 3 41 4 41 3 41 4 23 3 49 4 42 3 43 3 44 4 22 139 45 4 23 138 42 5 199</runs>
        <runs>0 8 2 3 3 1 14 1 21 2 2 3 41 3 66 5 15 5 4 3 36 4 38 3 37 3 42 5 41 4 58 5 22 4 37 3 40 3 36 4 37 5 23 3 41 3 41 4 41 3 41 4 23 3 49 4 42 3 43 3 44 4 22 139 45 4 23 138 42 5 199</runs>
        <runs>0 8 1 95 1 178 1 385 1 323 1 713 1</runs>
      </run-table>
    </glyph>
    <glyph left="166" top="1063" id="278">
      <run-table orientation="HORIZONTAL" width="1710" height="6">
        <runs>0 364 1</runs>
        <runs>0 198 1 120 1 43 2 46 1 65 1 22 1 126 1 41 1 626 1</runs>
        <runs>0 3 3 30 1 12 2 4 1 3 1 11 2 12 4 1 1 3 1 5 1 3 28 4 5 3 13 3 5 3 2 5 5 1 3 5 7 1 2 3 17 1 19 3 38 4 36 3 42 5 42 3 4 1 8 1 44 4 3 2 2 1 16 126 13 3 13 2 6 5 23 136 1 15 2 19 4 3 1 3 5 1 4 1 9 147 9 7 8 3 6 2 9 4 5 2 4 1 6 3 9 4 2 10 8 8 4 5 2 8 5 1 22 2 6 1 27 2 3 4 3 8 1 8 1 6 20 1 4 4 1 2 21 1 11 2 4 1 5 1 6 3 2 4 11 1 26 6 3 4 2 1 2 7 1 12 1 9 1 6 1 49 1 199 1</runs>
        <runs>0 3 98 3 66 5 24 3 37 3 38 4 36 3 42 5 42 3 58 4 24 126 37 5 23 136 41 3 24 147 44 4 206 4 203 4 201</runs>
        <runs>0 3 5 1 2 11 5 2 9 1 27 5 3 11 10 2 4 3 2 1 8 1 31 1 7 2 3 1 3 4 2 5 3 1 14 4 2 3 16 1 20 3 30 2 6 4 36 3 15 3 9 3 12 7 5 6 5 7 1 1 3 1 6 1 4 3 2 1 55 4 24 126 15 1 3 2 5 1 10 5 3 1 3 1 15 136 27 1 13 3 24 147 22 3 3 2 2 3 9 4 5 1 8 2 172 1 3 1 7 4 2 6 1 1 4 2 3 6 184 4 201</runs>
        <runs>0 242 1 168 1 3 1 84 1 975 1 2 2 8 2 10 2 15 1 6 1 12 171</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1199" id="279">
      <run-table orientation="HORIZONTAL" width="1750" height="7">
        <runs>0 81 3 90 1 76 1 52 1 101 1 144 1</runs>
        <runs>0 3 25 4 4 10 3 2 5 7 8 1 4 3 5 55 2 3 7 22 2 3 1 5 1 16 1 13 1 31 1 3 3 15 3 16 1 1 3 6 1 4 4 2 4 7 1 13 1 10 1 23 1 33 3 47 1 2 2 5 1 16 1 69 1 12 2 74 10 4 3 23 1 33 1 2 2 3 2 17 2 4 1 306 1 139 1 10 1 91 1 37 1</runs>
        <runs>28 4 4 10 30 3 5 6 51 3 31 3 2 4 28 3 33 3 29 6 14 4 13 4 15 4 31 4 32 3 31 4 15 4 12 5 16 17 17 19 2 1 13 17 18 5 17 17 36 4 35 2 34 6 30 5 179 4 80 3 30 1 6 3 9 7 3 8 1 2 2 3 2 7 1 3 3 1 4 5 1 5 1 13 1 9 1 3 2 10 1 25 1 1 1 1 1 2 2 26 11 20 2 2 2 4 1 2 3 2 2 18 23 3 36 3 41 4 34 45 1 27 1</runs>
        <runs>0 27 1 4 4 29 3 7 1 3 5 6 4 5 5 18 1 17 1 3 10 3 3 1 3 1 2 5 3 3 2 4 28 3 33 3 29 6 14 4 13 4 15 4 31 4 32 3 31 4 15 4 12 5 16 17 17 19 2 1 13 17 18 5 17 17 36 4 35 2 34 6 30 5 179 4 80 3 37 3 32 3 39 4 19 3 4 3 35 18 19 20 20 18 23 3 36 3 41 4 34 45 30 5 189</runs>
        <runs>0 27 1 4 1 2 1 43 2 205 1 17 1 30 1 18 2 43 3 4 1 13 1 10 2 7 1 4 2 1 2 9 1 21 1 14 1 17 1 6 10 20 1 1 9 1 3 32 3 5 2 32 2 29 2 1 2 4 1 10 2 21 1 2 1 39 1 28 1 182 2 4 1 55 2 9 3 9 1 22 2 15 1 3 1 1 2 3 4 20 1 3 5 1 33 4 2 1 5 5 6 3 4 3 6 3 2 1 23 18 19 20 4 4 4 1 2 2 3 18 23 3 17 1 18 3 12 1 2 7 19 4 34 45 30 5 189</runs>
        <runs>0 79 1 365 1 78 1 33 1 5 2 40 1 33 1 73 1 255 1 205 1 28 1 110 1 18 4 18 1 3 1 34 1 3 1 77 1 45 1 34 1 70 3 5 5 4 4 3 3 1 5 1 6 1 77</runs>
        <runs>0 1747 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1213" id="280">
      <run-table orientation="HORIZONTAL" width="1750" height="7">
        <runs>0 88 1 51 1 70 1 388 1 116 1 35 1</runs>
        <runs>0 2 18 68 1 3 1 47 1 3 1 2 2 16 1 12 2 3 2 5 1 19 2 3 1 31 1 4 1 12 16 5 4 3 2 1 4 26 2 1 7 4 2 11 2 19 1 21 1 29 3 2 2 6 2 11 2 42 1 65 2 1 1 6 1 26 2 79 2 31 2 2 2 12 6 12 5 58 2 3 3 1 1 69 1 9 2 72 1 195 1 387 1</runs>
        <runs>0 2 18 20 23 4 9 8 5 3 49 3 36 3 29 3 33 3 30 5 14 15 21 4 31 3 32 4 31 5 14 16 21 3 31 4 31 4 31 4 15 20 22 18 35 2 37 3 30 5 30 68 3 2 76 4 79 4 37 3 32 3 39 4 26 3 35 4 18 1 14 3 36 3 32 1 6 4 19 19 11 3 4 4 19 3 36 3 38 3 7 1 7 2 14 4 31 2 12 6 25 1 3 6 7 2 5 4 6 1 2 5 6 6 2</runs>
        <runs>0 15 3 1 1 20 17 2 4 4 1 2 6 8 5 3 5 1 13 3 27 3 36 3 29 3 33 3 30 5 14 15 21 4 31 3 32 4 31 5 14 16 21 3 31 4 31 4 31 4 15 20 22 18 35 2 37 3 30 5 30 68 3 2 76 4 79 4 37 3 32 3 39 4 26 3 35 4 33 3 36 3 39 4 19 19 11 3 4 4 19 3 36 3 38 3 31 4 188</runs>
        <runs>0 88 1 3 1 71 2 13 1 3 2 2 1 7 2 14 1 3 4 23 6 30 3 5 3 3 5 1 2 15 4 4 1 1 4 2 5 4 1 4 1 9 1 8 7 3 8 3 3 1 17 4 31 5 14 16 21 3 31 4 31 4 31 4 15 20 22 18 35 2 27 4 6 3 4 2 24 5 30 68 3 2 13 3 60 4 79 4 37 3 32 3 39 4 26 3 35 4 33 3 36 3 39 4 19 19 11 3 4 4 19 3 36 3 38 3 31 4 188</runs>
        <runs>0 1058 1 298 1 22 1 59 1 38 1 74 1 4 1 83 2 16 3 41 3 11 28</runs>
        <runs>0 1662 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1226" id="281">
      <run-table orientation="HORIZONTAL" width="1750" height="8">
        <runs>0 299 1</runs>
        <runs>0 77 1 18 1 189 1 12 1 7 1 28 1 102 2 159 1 22 1 129 1</runs>
        <runs>0 2 10 13 1 18 19 14 12 3 5 6 29 1 8 110 30 5 14 4 33 73 8 2 21 5 7 3 2 1 1 4 1 6 1 23 2 3 1 22 1 3 4 18 2 3 2 8 2 3 2 26 4 4 1 6 2 5 1 3 1 3 4 10 3 1 3 4 1 3 4 18 11 4 22 3 1 3 9 1 18 1 3 3 18 8 4 5 2 2 1 5 1 2 17 4 26 2 7 3 3 1 12 90 1 83 1 424 1 40 1</runs>
        <runs>0 2 10 13 1 18 19 4 2 8 12 3 5 6 38 110 30 5 14 4 33 73 31 5 14 4 33 3 31 4 31 3 32 4 15 3 14 4 19 18 37 3 36 3 30 5 30 4 35 3 19 57 31 4 42 4 34 91 2 28 1 13 3 7 2 19 5 13 1 6 3 2 1 25 1 2 2 10 3 2 4 14 1 3 1 18 4 12 4 4 1 15 2 15 1 6 6 1 1 4 4 3 3 20 1 1 24 1 1 5 3 3 2 19 1 5 1 8 2 27 3 3 1 5 1 30 1</runs>
        <runs>0 11 1 32 1 43 1 3 2 2 1 6 1 36 1 110 1 2 2 5 2 4 4 5 5 5 5 1 8 4 33 73 31 5 14 4 33 3 31 4 31 3 32 4 15 3 14 4 19 18 37 3 36 3 30 5 30 4 35 3 19 57 31 4 42 4 34 78 38 5 26 12 26 4 34 2 36 3 39 4 48 4 4 3 3 20 36 3 38 3 31 5 32 129 27</runs>
        <runs>0 92 1 211 1 23 1 92 2 13 2 2 1 5 1 7 2 15 1 1 1 13 2 1 4 1 2 3 1 3 3 7 4 3 3 4 3 4 18 1 12 3 21 9 2 4 1 8 2 3 1 3 4 1 4 4 1 64 3 48 2 110 1 105 1 4 1 6 3 3 1 1 3 18 2 2 2 4 1 10 2 3 4 11 1 80 38 5 26 12 26 4 34 2 36 3 39 4 48 4 2 5 3 20 36 3 38 3 31 5 23 1 8 129 27</runs>
        <runs>0 530 1 4 1 29 1 3 1 606 1 56 2 4 1 75 1 3 1 37 1 121 1 40 1 33 1 166 27</runs>
        <runs>0 1239 1 507 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1240" id="282">
      <run-table orientation="HORIZONTAL" width="1750" height="8">
        <runs>0 93 1</runs>
        <runs>0 10 1 78 1 2 2 706 1</runs>
        <runs>0 3 8 6 1 2 1 6 1 5 1 15 1 39 1 2 2 192 1 313 1 185 1 13 2 19 1 39 1 2 1 33 1 2 1 124 1</runs>
        <runs>11 6 4 6 7 3 6 6 41 2 2 2 185 5 155 5 51 72 32 4 16 14 63 20 19 20 30 5 30 4 36 2 35 2 35 4 31 4 42 9 2 2 103 1 3 3 1 4 5 1 4 3 14 4 28 2 9 104 1 4 2 3 10 1 1 3 1 2 5 2 4 4 4 1 13 3 6 1 21 10 25 2 15 20 7 6 11 16 1 5 2 14 1 8 1 14 2 8 2 4 7 2 1 24 1 9 2 46 1 39 1</runs>
        <runs>0 1 10 6 4 6 7 3 6 6 41 2 2 2 185 5 155 5 51 72 32 4 16 14 63 20 19 20 30 5 30 4 36 2 35 2 35 4 31 4 42 9 2 2 142 4 40 103 39 4 49 10 42 20 24 16 32 5 32 2 45 4 35 3 26 3 8 3 7 5 4 2 3 4 2</runs>
        <runs>0 17 1 13 3 3 2 168 1 3 5 32 1 31 1 5 1 2 1 3 3 9 3 1 1 8 6 12 4 32 2 5 5 4 8 1 4 1 17 2 3 1 16 5 8 2 41 72 32 4 16 14 63 20 1 6 2 9 1 20 1 1 6 1 10 2 3 2 4 5 2 1 3 3 2 7 3 3 1 9 1 20 2 12 1 2 1 1 2 13 1 14 3 2 2 8 2 2 1 1 1 6 1 10 1 8 27 4 30 1 11 9 2 2 4 1 137 4 40 103 39 4 49 10 42 20 24 16 32 5 32 2 45 4 35 3 37 3 27</runs>
        <runs>0 280 1 288 4 11 1 15 1 4 1 14 1 277 1 127 2 56 1 9 4 5 1 1 35 2 7 2 21 4 40 103 39 4 49 10 42 20 24 16 32 5 32 2 45 4 35 3 37 3 27</runs>
        <runs>0 1027 1 143 1 545 1 29 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1255" id="283">
      <run-table orientation="HORIZONTAL" width="1750" height="8">
        <runs>0 21 2</runs>
        <runs>0 21 5 13 3 238 1 319 1 4 1 291 1 3 1 455 1</runs>
        <runs>17 4 13 5 3 2 237 5 155 5 24 4 2 2 13 1 11 1 3 2 10 1 11 19 12 2 3 2 2 14 16 4 6 1 8 4 163 4 15 20 35 3 34 3 35 13 7 11 4 4 2 2 1 9 6 12 10 3 2 2 2 4 1 11 3 4 2 9 1 110 1 185 1 196 1 87 1 104 1</runs>
        <runs>0 1 16 4 13 5 3 2 237 5 155 5 155 4 15 4 163 4 15 20 35 3 34 3 35 4 31 4 10 3 29 3 11 4 137 4 5 3 46 8 3 4 6 11 9 1 1 5 33 2 4 3 10 5 1 1 21 4 84 5 40 2 2 3 6 17 1 4 2 1 3 2 3 9 3 3 3 7 4 7 1 1 2 17 2 4 6 5 6 7 2 16 2 19 5 8 1 25 1 14 1 28 2</runs>
        <runs>0 25 9 5 1 352 5 2 6 41 11 2 4 2 2 3 2 3 1 2 30 1 92 4 7 1 4 1 2 4 6 1 6 2 2 5 10 1 57 2 1 2 1 8 6 4 4 3 6 1 12 10 2 29 1 58 1 32 1 3 1 31 3 4 9 1 14 2 5 4 10 3 3 1 3 2 1 3 8 1 3 1 3 3 9 1 1 4 1 2 134 4 182 4 142 17 34 5 17 17 14 3 28 3 35 4 37 3 27</runs>
        <runs>0 28 6 950 1 129 4 5 1 3 3 3 3 3 10 4 2 5 3 1 3 17 4 5 2 21 2 1 7 2 3 1 1 5 2 9 25 2 5 9 6 3 12 1 1 2 1 4 10 4 5 4 3 1 1 6 1 7 2 3 15 4 118 17 34 5 17 17 14 3 28 3 35 4 37 3 27</runs>
        <runs>0 1594 1 12 1 3 1 30 1 72 3 14 2 3 3 5 3</runs>
        <runs>0 1611 1</runs>
      </run-table>
    </glyph>
    <glyph left="127" top="1394" id="284">
      <run-table orientation="HORIZONTAL" width="1751" height="6">
        <runs>0 17 2 56 1 3 4 112 1 38 1 228 1 46 1</runs>
        <runs>27 4 3 11 31 3 4 6 107 2 37 3 33 3 36 4 15 4 10 7 22 4 3 3 6 2 28 4 38 3 9 2 25 4 8 8 2 3 4 17 1 3 21 19 22 18 21 17 22 4 97 89 33 4 44 4 10 1 6 4 2 9 18 11 5 19 2 20 2 47 5 22 3 86 1 2 2 204 2</runs>
        <runs>27 4 3 11 31 3 4 6 107 2 37 3 33 3 36 4 15 4 11 6 22 4 3 3 36 4 38 3 36 4 8 8 9 17 1 3 21 19 22 18 21 17 22 4 97 89 33 4 44 4 95 4 122 4 48 2 105 3 62 17 59 4 32 17 36 4 31 16 13 7 5 3 1 2 3 7 3 1 3 19 3 19 32</runs>
        <runs>0 16 2 7 2 4 3 28 1 1 1 10 1 3 4 6 7 9 14 2 3 3 6 2 3 12 2 7 1 2 2 5 4 7 1 13 2 2 37 3 33 3 36 4 15 4 11 6 22 4 3 3 36 4 38 3 36 4 8 8 9 17 1 3 21 19 22 18 21 17 22 4 97 89 33 4 44 4 95 4 122 4 48 2 105 3 62 17 59 4 32 17 36 4 31 16 35 3 32 17 34</runs>
        <runs>0 79 1 9 1 224 1 28 1 119 1 34 1 194 1 369 1 172 1 2 1 90 1 12 1 3 1 78 1 62 1 48 1 39 1 15 9 4 2 16 6 2 6 2 19 3 32 17 34</runs>
        <runs>0 1347 1 311 1 3 1 81 1</runs>
      </run-table>
    </glyph>
    <glyph left="127" top="1408" id="285">
      <run-table orientation="HORIZONTAL" width="1751" height="6">
        <runs>0 1 17 21 3 3 2 8 2 7 2 3 4 1 2 17 1 4 4 4 6 3 6 7 4 28 1 109 1 3 1 39 1 63 1 80 1 3 1 34 1 32 1 36 1 124 1 99 1 38 1 42 1 35 1 4 1 322 1</runs>
        <runs>18 21 22 3 12 7 6 4 10 1 91 3 37 3 33 3 29 1 6 4 2 3 10 13 25 1 11 3 36 4 38 3 36 4 15 9 1 3 1 3 6 2 1 6 3 3 1 3 3 3 3 21 1 5 2 9 2 17 1 2 1 3 3 3 4 2 2 17 1 3 16 2 3 4 24 17 25 4 27 3 40 3 40 3 4 2 18 3 4 1 1 4 3 2 4 1 1 3 31 3 1 1 8 4 7 1 1 6 2 5 1 9 3 50 1 172 1 2 1 54 1 42 3 3 1 4 1 140 1 169 1 3 1</runs>
        <runs>0 3 15 21 17 1 4 3 12 7 6 4 8 4 90 3 37 3 33 3 36 4 15 13 37 3 36 4 38 3 36 4 25 3 13 6 19 17 23 17 21 17 25 4 24 17 25 4 27 3 40 3 40 3 33 4 11 3 31 3 49 8 38 4 53 16 53 4 48 2 56 10 39 4 137 4 85 4 82 3 84</runs>
        <runs>0 15 3 46 1 8 2 18 1 104 2 10 11 4 10 3 29 3 1 3 2 3 4 3 3 3 18 4 15 13 37 3 36 4 38 3 36 4 25 3 13 6 19 17 23 17 21 17 25 4 24 17 11 2 12 4 15 4 8 3 40 3 40 3 33 4 11 3 2 5 14 4 6 3 49 8 38 4 53 16 53 4 48 2 56 10 39 4 137 4 85 4 82 3 84</runs>
        <runs>0 234 1 143 1 84 1 67 1 36 1 39 1 37 1 41 1 4 1 142 1 38 1 35 1 4 1 146 1 41 3 7 1 16 1 51 1 51 1 2 1 97 4 2 1 4 1 67 2 22 2 15 1 1 3 22 1 4 2 5 3 1 1 1 3 5 1 8 5 1 4 2 15 6 10 1 4 1 6 4 82 3 84</runs>
        <runs>0 1132 1 356 1 130 5 32 3 3 2 1 1 18 3 8 9 2 6 8 10 3 1 1 5 1 3 1 1</runs>
      </run-table>
    </glyph>
    <glyph left="127" top="1421" id="286">
      <run-table orientation="HORIZONTAL" width="1751" height="7">
        <runs>0 97 1 97 1</runs>
        <runs>0 64 1 10 1 19 3 60 1 36 1 133 1 238 1 189 1 152 1 496 1</runs>
        <runs>0 1 10 12 1 21 16 3 4 7 14 4 5 6 55 7 30 78 36 5 15 3 46 84 36 4 25 15 26 3 29 1 6 4 35 3 39 4 21 21 24 11 6 18 25 17 26 17 33 4 11 11 8 18 44 10 1 1 1 1 15 7 1 18 1 28 4 5 1 3 2 3 1 3 1 54 2 12 2 4 4 2 1 43 1 61 1 17 1 23 1 4 1 59 2 45 1 13 2 14 1 3 1 256 1</runs>
        <runs>0 1 10 12 1 21 16 3 4 7 14 4 5 6 55 7 30 78 36 5 15 3 46 84 36 4 25 15 26 3 36 4 35 3 39 4 21 21 24 11 6 18 25 17 26 17 33 4 11 11 8 18 44 10 41 4 122 4 31 19 51 11 43 4 48 12 18 13 17 13 17 3 39 1 12 1 9 1 12 1 4 3 2 4 4 1 3 1 2 6 2 66 2 46 3 11 2 17 3</runs>
        <runs>0 10 1 12 1 36 1 3 1 10 1 4 1 3 1 8 5 6 2 1 1 9 1 39 2 31 2 2 2 78 36 5 15 3 46 84 36 4 25 15 26 3 36 4 35 3 39 4 21 21 24 11 6 18 25 17 26 17 33 4 11 11 8 18 44 10 41 4 122 4 31 19 51 11 43 4 48 12 18 13 17 13 17 3 85 4 81 4 84</runs>
        <runs>0 10 1 82 1 64 1 174 1 12 4 28 1 84 1 10 1 28 1 9 1 13 1 19 10 3 9 3 14 1 7 3 4 2 5 4 35 3 15 1 1 3 1 11 1 4 2 4 2 5 2 6 1 3 2 21 1 22 1 77 1 74 1 4 1 7 3 11 8 33 2 3 12 1 5 5 1 18 17 5 11 4 122 4 31 19 51 11 43 4 48 12 18 13 17 13 17 3 85 4 81 4 84</runs>
        <runs>0 693 1 545 1 245 1 3 1 173 1 81 2</runs>
      </run-table>
    </glyph>
    <glyph left="127" top="1434" id="287">
      <run-table orientation="HORIZONTAL" width="1751" height="8">
        <runs>0 94 1</runs>
        <runs>0 10 1 82 2</runs>
        <runs>0 8 3 9 1 27 1 44 2 63 1 2 1 28 2 501 1 326 2</runs>
        <runs>0 1 10 6 4 5 7 3 6 6 41 4 2 2 62 2 7 7 21 3 3 2 4 2 9 3 3 3 1 5 1 7 2 1 6 2 2 4 3 2 5 3 7 2 8 4 3 1 1 11 1 5 3 4 6 5 2 14 2 2 5 22 25 4 8 2 4 9 2 10 4 2 9 1 6 1 2 3 1 1 1 2 7 6 4 2 3 4 1 23 1 4 1 3 1 34 1 48 1 25 1 3 1 37 1 4 2 3 2 4 3 6 1 3 1 3 2 11 1 2 6 6 1 3 1 4 1 10 3 1 1 35 1 4 1 21 2 19 3 51 1 3 1 10 1 11 1 5 1 75 3 57 1 158 1 103 1</runs>
        <runs>11 6 4 5 7 3 6 6 41 4 2 2 62 2 7 7 135 5 184 4 25 4 36 3 37 4 35 3 39 4 21 3 12 5 25 10 5 20 23 19 24 19 33 3 12 11 7 19 1 3 39 13 32 4 1 6 9 1 20 1 10 1 2 1 10 2 25 2 24 2 12 4 1 4 14 6 3 1 5 16 2 6 2 1 2 3 5 1 2 2 4 2 19 15 4 6 5 5 3 4 3 5 4 4 2 6 3 9 4 5 1 7 4 2 4 3 6 2 1 18 1 3 2 1 2 10 1 6 2 1 2 2 1 2 1 1 3 1 1 16 1 4 1 9 3 71 1 4 1 84 1 83 1</runs>
        <runs>0 10 1 9 1 7 2 2 1 3 2 10 1 109 1 2 1 39 1 6 10 6 4 8 18 2 2 3 11 3 2 4 2 4 2 8 2 5 6 5 25 2 157 4 25 4 36 3 37 4 35 3 39 4 21 3 12 5 25 10 2 1 2 20 23 19 24 19 33 3 12 11 7 19 43 13 39 4 122 4 34 16 51 15 39 4 24 5 18 3 28 3 27 2 27 4 85 4 34 11 36 4 85</runs>
        <runs>0 36 1 121 1 408 1 3 4 1 4 2 2 2 1 2 2 5 1 5 6 4 12 12 1 9 1 3 9 34 1 19 1 44 1 77 1 2 2 70 1 3 1 77 3 7 3 35 1 3 1 3 4 5 1 4 10 1 28 1 82 4 14 2 6 3 3 4 2 16 51 15 39 4 24 5 18 3 28 3 27 2 27 4 85 4 34 11 36 4 85</runs>
        <runs>0 758 1 152 1 151 1 120 1 54 1 103 1 111 1 2 1 30 1 83 1 4 1 29 4 11 1 13 4 1 3 2 10 1 1 4 2 3 16 4 1 2 7 2 17 1 30</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1450" id="288">
      <run-table orientation="HORIZONTAL" width="1752" height="6">
        <runs>0 569 1</runs>
        <runs>0 22 6 5 1 124 2 2 1 262 1 4 1 73 1 5 1 2 1 3 1 34 1 15 2 86 1 37 1 37 1 37 1 20 1 10 1 34 1 18 1 19 1 35 1 47 1 41 1 182 1 162 1 47 1 62 1</runs>
        <runs>18 4 12 10 116 2 11 4 134 5 184 4 66 81 39 4 21 12 39 4 22 3 39 3 40 3 33 4 18 4 22 3 92 1 3 4 122 4 5 2 18 1 1 1 3 20 7 3 5 1 12 1 5 2 24 1 6 3 3 11 2 5 4 5 4 3 6 2 7 1 2 5 5 4 3 4 4 1 5 62 4 3 2 2 1 14 2 3 1 47 1 35 1 85 1 87 1</runs>
        <runs>18 4 12 10 116 2 11 4 134 5 184 4 66 81 39 4 21 12 39 4 22 3 39 3 40 3 33 4 18 4 22 3 92 1 3 4 122 4 31 20 104 3 49 62 28 3 33 15 37 4 19 1 10 12 3 1 5 3 4 8 2 12 2 3 1 44 2 12 2 11 2 2 9</runs>
        <runs>0 29 5 125 1 2 1 127 1 39 3 3 5 5 1 1 10 13 1 1 5 5 16 12 11 2 7 1 4 1 4 2 3 2 2 9 3 1 1 2 16 7 1 1 9 4 5 1 39 2 19 81 39 4 21 12 39 4 22 3 39 3 40 3 13 1 19 4 18 4 22 3 92 1 3 4 122 4 31 20 104 3 49 62 28 3 33 15 37 4 30 12 40 3 85</runs>
        <runs>0 1459 1 34 1 15 1 11 1 15 3 7 27 4 30 12 40 3 85</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="1580" id="289">
      <run-table orientation="HORIZONTAL" width="1751" height="8">
        <runs>0 82 3 335 4 312 1 58 1</runs>
        <runs>7 15 2 3 2 4 1 12 1 16 4 8 1 3 6 73 6 13 2 28 3 4 7 13 3 5 6 3 52 16 5 7 7 1 3 3 1 4 8 2 1 1 1 2 5 2 1 19 2 2 2 9 10 3 7 5 1 3 1 1 4 2 5 1 3 14 1 4 1 3 1 13 17 3 2 6 4 128 1 51 1 2 1 30 1 58 1 28 1 49 1 2 1 27 1 2 1 79 8 259 1</runs>
        <runs>29 4 3 10 30 3 6 4 62 2 11 3 21 16 26 4 69 16 27 4 23 19 25 3 9 3 36 4 117 4 23 3 21 10 24 5 24 2 21 10 28 4 15 12 30 2 23 4 21 2 29 2 27 3 42 2 14 1 22 16 35 5 79 17 5 2 9 3 11 3 3 4 11 4 1 6 3 19 3 1 41 8 17 2 1 3 1 7 1 5 3 4 1 4 9 2 13 3 6 2 54 2 20 3 4 6 1 11 2 3 1 1 2</runs>
        <runs>0 1 28 4 3 10 30 3 6 4 62 2 11 3 21 16 26 4 69 16 27 4 23 19 25 3 9 3 36 4 117 4 23 3 21 10 24 5 24 2 21 10 28 4 15 12 30 2 23 4 21 2 29 2 27 3 42 2 14 1 22 16 35 5 79 17 36 4 25 19 45 4 36 5 130 4 127 25 1 26 4 1 3 2 1 4 4 12 10 16 1 3 1 1 1 21 3</runs>
        <runs>0 28 1 4 1 45 1 4 1 4 1 63 5 13 1 4 2 56 1 84 1 30 1 75 3 38 1 4 1 115 1 4 1 21 1 85 2 2 1 30 1 25 2 4 1 13 1 12 1 28 1 2 1 21 1 4 1 19 1 2 1 27 1 2 1 25 1 3 1 43 7 29 1 43 2 5 1 5 1 11 3 13 2 1 5 2 1 2 6 8 1 6 3 12 2 17 1 1 12 2 1 3 4 10 2 4 2 7 1 2 1 2 1 7 2 19 5 1 24 1 3 1 10 4 18 1 7 1 2 1 6 5 10 3 14 2 1 2 7 1 2 5 4 5 12 1 5 4 13 1 3 2 2 6 2 1 22 4 24 2 106 3 13 4 56 2 60</runs>
        <runs>0 153 3 271 2 159 1 113 1 121 1 410 1 62 2 45 1 133 1 86 5 3 1 13 2 2 4 4 6 2 3 3 13 4 56 2 60</runs>
        <runs>0 1299 1 179 1 217 6</runs>
        <runs>0 1699 6</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="1593" id="290">
      <run-table orientation="HORIZONTAL" width="1751" height="8">
        <runs>0 80 1</runs>
        <runs>0 79 2 192 1 72 1 120 1 4 1 72 2 353 1 524 1</runs>
        <runs>0 1 3 2 3 7 1 2 1 19 1 10 1 11 1 3 2 11 2 153 1 38 2 2 8 2 3 9 1 45 2 3 2 18 2 12 1 10 2 11 1 1 8 1 4 27 1 8 3 5 1 4 3 18 1 51 3 40 1 4 2 78 1 31 1 58 1 3 1 58 1 26 1 45 2 3 1 28 1 3 1 76 1 103 1 86 1 218 2</runs>
        <runs>20 19 24 3 10 3 2 3 5 4 92 16 29 4 20 19 27 17 30 3 22 4 47 17 28 4 22 17 32 2 44 4 23 3 18 10 27 5 13 13 19 9 32 3 49 10 23 4 13 11 20 2 6 2 27 3 78 17 37 5 24 20 25 2 5 18 38 4 25 3 23 2 4 2 3 4 14 16 33 5 28 17 33 2 5 1 44 5 7 2 7 1 2 5 3 4 3 5 2 13 1 1 1</runs>
        <runs>0 2 5 1 1 4 7 19 24 3 10 3 2 3 5 4 10 1 81 16 29 4 20 19 27 17 30 3 22 4 47 17 28 4 22 17 32 2 44 4 23 3 18 10 27 5 13 13 19 9 32 3 49 10 23 4 13 11 20 2 6 2 27 3 78 17 37 5 24 20 32 18 38 4 25 3 52 16 33 5 28 17 33 2 5 1 44 5 79 16 35 4 13 4 3 6 6 19 35 17 32</runs>
        <runs>0 88 1 4 1 57 2 31 1 49 1 97 1 17 1 121 1 38 1 36 3 37 1 4 1 20 2 3 1 52 2 17 1 13 1 57 2 3 1 47 1 10 1 21 1 4 1 23 1 21 1 3 2 2 1 24 2 3 2 74 2 40 14 5 7 4 2 4 4 23 8 1 7 2 4 2 8 18 38 4 25 3 52 16 33 5 28 17 23 1 9 2 5 1 44 5 79 16 35 4 13 4 3 6 6 19 35 17 32</runs>
        <runs>0 588 1 349 1 76 1 53 1 5 1 74 1 60 1 23 1 109 1 82 2 1 1 48 1 60 1 33 1 3 1 1 3 11 9 1 5 4 13 4 3 6 6 19 35 17 32</runs>
        <runs>0 1645 1 19 4 5 1 18 7 17 1 1 6 4 1 3 1 4 6 4 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="1608" id="291">
      <run-table orientation="HORIZONTAL" width="1751" height="7">
        <runs>0 155 1 404 1</runs>
        <runs>0 24 1 41 1 26 4 58 1 28 1 114 1 3 1 42 1 61 1 5 1 3 2 47 1 4 1 18 1 68 1 203 1 3 1 214 1 31 1 86 1 108 1</runs>
        <runs>0 2 11 11 1 22 16 3 3 8 12 4 4 6 10 1 23 18 30 3 42 4 19 4 43 3 44 4 21 4 44 17 31 4 20 17 31 20 28 5 13 13 54 5 87 3 47 9 26 4 11 9 21 13 27 4 25 19 33 2 52 5 24 3 49 3 40 1 12 4 8 3 14 3 1 5 1 2 3 1 5 10 2 3 1 1 2 10 2 17 1 7 6 6 6 1 8 5 7 1 10 6 2 16 2 2 22 1 8 19 4 3 2 1 10 4 3 5 2 5 2 15 4 23 1 30 1</runs>
        <runs>0 2 5 5 1 11 1 22 3 3 4 2 4 3 3 8 12 4 4 6 10 1 23 18 30 3 42 4 19 4 38 1 1 2 1 3 44 4 21 4 44 17 31 4 20 17 31 20 28 5 13 13 54 5 87 3 47 9 26 4 11 9 21 13 27 4 25 19 33 2 52 5 24 3 49 3 53 4 25 3 49 17 35 5 26 16 35 19 34 5 25 19 32 17 37 4 11 1 16 1 3 6 23 1 7 8 2 21 17 1 3 3 3 5 3</runs>
        <runs>0 77 1 10 1 4 4 6 1 51 1 32 1 2 5 33 1 27 1 87 2 125 1 18 1 36 3 4 1 3 1 26 12 6 4 9 7 1 1 13 1 8 1 2 1 3 1 1 1 1 18 1 3 4 2 5 1 5 1 11 2 5 14 5 1 2 4 4 1 1 5 2 2 7 11 3 2 3 1 3 1 12 7 1 1 1 24 9 12 1 10 2 1 4 6 3 1 10 14 2 5 13 27 4 7 1 4 1 12 19 33 2 52 5 24 3 49 3 53 4 25 3 49 17 35 5 26 16 35 19 34 5 25 19 32 17 37 4 32 3 48 17 35</runs>
        <runs>0 93 1 397 1 714 1 28 1 51 1 267 1 53 1 4 2 12 2 4 1 5 1 4 1 3 15 1 14 2 3 3 1 1 2 3 3 17 16 3 16</runs>
        <runs>0 1748 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="1621" id="292">
      <run-table orientation="HORIZONTAL" width="1751" height="9">
        <runs>0 12 1 81 1</runs>
        <runs>0 12 1 79 3 208 1 42 1 3 1 121 1 21 1 93 1 426 1</runs>
        <runs>0 4 9 7 3 10 2 3 2 4 1 5 7 5 16 2 2 6 1 3 3 3 2 3 5 2 7 2 6 2 3 5 1 3 1 20 7 6 1 5 2 3 1 3 1 20 8 12 1 4 1 2 2 4 3 2 1 3 1 3 1 3 1 1 12 2 24 3 7 8 3 7 19 3 8 3 11 6 3 3 36 3 20 2 23 4 20 2 13 8 3 9 2 4 1 5 1 3 2 9 4 12 1 16 2 18 1 42 2 9 1 9 2 5 1 13 1 5 4 12 2 5 3 3 1 35 1 4 1 85 1 44 2 33 1 28 1 51 1 58 1</runs>
        <runs>0 2 11 6 4 5 7 3 7 5 39 3 3 3 38 3 46 3 42 4 19 3 44 3 44 3 22 4 44 3 45 4 20 2 46 3 46 4 80 5 86 4 82 4 81 4 25 3 49 3 22 1 9 1 1 2 2 1 2 1 1 7 1 4 4 2 1 3 3 2 3 3 4 4 16 6 2 3 2 1 3 1 7 1 1 4 1 4 1 4 1 9 5 3 3 6 1 6 1 11 1 4 2 22 1 3 1 42 5 4 1 53 1 23 1 2 2 7 1 19 1 6 1 2 1 9 1 3 2 8 1 1 2 19 1 45 1</runs>
        <runs>0 9 4 15 1 1 5 3 5 7 1 12 3 5 8 2 6 1 1 3 3 3 3 9 3 22 1 3 1 18 2 1 2 1 2 14 2 1 2 3 8 5 5 7 6 1 7 1 2 4 3 3 6 3 4 3 10 16 2 15 1 3 1 1 4 9 2 4 3 1 2 2 5 2 2 3 3 3 3 1 3 7 4 3 1 4 2 2 2 36 2 3 1 5 2 1 5 4 5 10 3 7 2 4 7 4 2 4 3 2 46 3 46 4 80 5 86 4 82 4 81 4 25 3 49 3 51 4 25 4 48 4 52 4 25 3 48 4 49 5 25 2 50 3 50 5 25 3 48 3 51 4 32 3 49 2 49</runs>
        <runs>0 10 2 26 1 311 1 116 1 4 1 21 1 48 1 44 1 174 1 4 1 85 1 11 2 31 4 30 2 27 2 3 8 1 4 3 1 14 1 2 3 9 3 3 8 1 2 1 39 4 25 4 48 4 52 4 25 3 48 4 49 5 25 2 50 3 50 5 25 3 48 3 51 4 32 3 49 2 49</runs>
        <runs>0 1074 1 75 1 4 1 50 1 32 1 51 1 80 1 52 1 54 1 23 1 3 1 45 2 3 1 40 3 1 3 1 2 4 2 2 28 3 49 2 49</runs>
        <runs>0 1645 1 50 2 2 2 2 4 1 3 21 2 13 1</runs>
        <runs>0 1697 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="1636" id="293">
      <run-table orientation="HORIZONTAL" width="1751" height="7">
        <runs>0 36 1</runs>
        <runs>0 24 6 5 2 98 1 48 1 2 1 46 1 18 1 2 1 89 1 72 1 47 1 4 1 18 1 2 1 268 1 3 1 166 1</runs>
        <runs>22 2 13 7 92 3 46 2 43 4 20 2 44 3 44 3 70 3 45 4 20 2 46 3 46 4 27 17 36 4 36 17 34 3 33 17 33 4 31 17 33 4 25 3 49 3 51 4 25 4 49 3 52 4 19 1 11 2 2 3 2 7 9 6 3 3 9 3 4 4 4 6 14 1 16 4 1 1 24 3 10 1 14 2 22 3 25 1 5 3 2 1 4 1 5 2 1 4 3 22 1</runs>
        <runs>22 2 13 7 92 3 46 2 43 4 20 2 44 3 44 3 70 3 45 4 20 2 46 3 46 4 27 17 36 4 36 17 34 3 33 17 33 4 31 17 33 4 25 3 49 3 51 4 25 4 49 3 52 4 77 3 49 4 26 3 49 3 50 4 26 3 48 3 11 2 3 17 4 13 1 4 2 29 1 3 1 47 1 2 1 46 2</runs>
        <runs>0 35 2 150 2 1 1 62 1 2 1 237 1 44 1 3 1 18 2 16 2 1 1 22 2 5 3 3 1 17 1 7 2 65 1 19 4 27 1 3 1 11 2 2 3 1 3 2 4 3 1 17 1 6 2 5 1 5 1 3 6 7 2 2 1 7 1 35 14 2 6 8 3 4 9 2 5 7 2 3 22 3 24 3 51 4 25 4 49 3 52 4 77 3 49 4 26 3 49 3 50 4 26 3 48 3 51 4 32 3 49 2 49</runs>
        <runs>0 494 1 792 1 216 1 49 2 3 10 2 4 1 5 4 4 1 10 2 8 4 32 3 49 2 49</runs>
        <runs>0 1697 1 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1739" id="294">
      <run-table orientation="HORIZONTAL" width="1750" height="10">
        <runs>0 176 5 106 5</runs>
        <runs>0 83 2 89 7 106 8 521 1</runs>
        <runs>0 2 26 7 1 10 2 8 2 4 1 3 1 2 3 4 1 3 5 5 1 4 2 2 1 4 2 8 3 16 1 3 4 19 3 4 14 8 5 4 1 6 3 39 3 5 12 4 2 4 6 4 15 6 5 3 37 4 7 2 2 4 51 3 9 22 3 19 1 6 2 39 1 288 3</runs>
        <runs>0 1 27 5 3 10 31 3 5 5 91 4 45 5 48 4 18 3 5 3 37 4 11 4 63 18 27 5 23 19 31 18 27 5 8 5 67 18 24 5 7 5 67 2 8 3 18 4 3 3 2 2 2 4 1 2 3 11 7 16 11 2 5 7 1 24 2 129 1</runs>
        <runs>0 12 6 9 1 5 3 17 3 2 2 2 5 5 5 3 5 5 7 2 9 1 26 2 6 3 35 4 45 5 48 4 18 3 5 3 37 4 11 4 41 1 21 18 27 5 23 19 31 18 27 5 8 5 67 18 24 5 7 5 67 2 8 3 34 4 24 16 30 20 31 5 9 7 12 17 30 20 29 5 27 16 20 2 5 19 1 7 3 2 4 29 1 144 1 65 1 45 1</runs>
        <runs>0 80 1 3 1 5 3 70 8 30 2 26 1 20 1 48 6 47 1 4 2 8 1 4 1 106 1 5 2 13 1 1 2 23 31 18 27 5 8 5 67 18 24 5 7 5 67 2 8 3 34 4 24 16 30 20 31 5 9 7 12 17 30 20 29 5 27 16 27 19 32 5 10 12 4 17 32 20 32 4 24 17 29 19 20 1 9 6 1 3 2 2 3 207 1</runs>
        <runs>0 304 1 297 1 5 1 97 1 114 3 36 1 44 1 28 1 130 1 20 10 18 1 5 1 1 2 2 2 8 4 1 3 1 2 16 21 1 5 19 32 5 10 7 9 17 32 20 32 4 24 17 29 19 30 4 13 7 10 16 33 19 31 4 22 16 30 19 28</runs>
        <runs>0 823 1 365 1 50 1 5 1 16 2 4 3 17 1 1 3 3 1 9 1 1 1 3 2 4 2 20 2 28 2 4 1 21 2 45 1 19 1 13 16 4 13 7 10 16 33 19 31 4 22 16 30 19 28</runs>
        <runs>0 1372 1 156 1 48 1 19 3 6 4 2 6 4 6 4 22 16 30 19 28</runs>
        <runs>0 1699 2 19 1 10 1 15 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1754" id="295">
      <run-table orientation="HORIZONTAL" width="1750" height="9">
        <runs>0 65 1 11 1 235 1 68 1 225 1</runs>
        <runs>0 1 19 26 4 15 2 9 2 16 3 10 3 3 2 3 2 3 5 5 2 8 6 6 3 2 2 7 2 39 2 12 6 5 1 20 2 1 2 8 5 7 3 12 18 2 37 5 11 3 1 9 5 19 14 4 4 4 1 17 1 15 2 10 2 5 1 21 1 64 1 29 1 5 1 7 1 39 1 124 1</runs>
        <runs>0 1 19 20 22 3 13 6 6 4 93 16 27 5 79 2 37 5 11 3 2 8 5 19 27 17 30 5 23 3 44 17 31 5 9 4 3 7 6 19 30 17 27 5 8 4 2 7 6 19 12 1 20 17 3 3 2 7 5 1 3 1 5 4 7 2 3 1 2 3 3 30 2 16 1 3 1 79 1 3 1 42 1 3 1</runs>
        <runs>0 2 18 20 22 3 13 6 6 4 93 16 27 5 79 2 37 5 11 3 2 8 5 19 27 17 30 5 23 3 44 17 31 5 9 4 3 7 6 19 30 17 27 5 8 4 2 7 6 19 33 17 30 4 21 17 32 3 48 5 21 3 4 3 12 6 26 3 8 21 2 6 2 6 2 4 1 21 1 49 1 82 1 101 1 68 1 2 1 46 1 3 1 32 1</runs>
        <runs>0 65 1 247 1 2 1 35 1 126 1 5 1 21 1 3 1 36 1 3 3 17 15 3 2 4 7 5 1 4 1 1 2 4 3 7 6 19 22 1 7 17 27 5 8 4 2 7 6 19 33 17 30 4 21 17 32 3 48 5 28 3 44 3 47 4 23 18 28 3 49 5 26 3 45 4 48 5 21 17 32 2 48 3 30 3 27 6 2 10 1 3 1 68 1 51 1 26 6 10 2</runs>
        <runs>0 728 2 5 1 25 1 19 1 31 1 17 1 28 1 4 1 65 4 3 20 2 5 4 1 11 5 8 25 3 44 3 47 4 23 18 28 3 49 5 26 3 45 4 48 5 21 17 32 2 48 3 30 3 46 3 44 2 1 5 10 7 1 47 1 3 1 10 4 2 1 2 25</runs>
        <runs>0 938 1 130 1 45 1 4 1 21 1 45 1 3 2 10 4 11 1 1 2 2 4 2 5 2 3 5 1 3 22 3 45 4 32 1 2 1 12 5 21 17 6 1 5 1 19 2 48 3 30 3 46 3 47 5 18 18 30 3 45</runs>
        <runs>0 1275 1 48 1 121 1 2 1 46 1 17 3 2 11 3 46 3 47 5 18 18 30 3 45</runs>
        <runs>0 1651 1 51 1 43 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1768" id="296">
      <run-table orientation="HORIZONTAL" width="1750" height="9">
        <runs>0 96 2</runs>
        <runs>0 3 5 3 1 12 2 39 1 28 4 59 1 72 1 4 1 80 1 35 1 5 1 31 1 21 4 20 1 42 1 5 1 21 1 427 1</runs>
        <runs>0 2 10 12 2 20 16 3 4 6 15 4 4 5 35 19 26 18 30 4 23 19 22 17 37 5 28 4 43 3 44 5 23 3 44 4 44 5 1 2 26 3 32 3 8 2 1 4 15 3 1 1 3 11 2 2 2 5 5 6 1 6 3 8 1 45 1 124 1 54 1</runs>
        <runs>0 24 2 20 16 3 4 6 15 4 4 5 35 19 26 18 30 4 23 19 22 17 37 5 28 4 43 3 44 5 23 3 44 4 44 5 29 3 46 4 40 5 26 3 47 18 32 4 21 4 46 2 48 4 29 3 44 3 46 5 14 1 2 1 5 3 3 3 1 2 1 5 5 3 3 4 10 1 2 3 1 47 1 5 1 28 1 47 1 73 1 3 1 47 1 79 1</runs>
        <runs>0 65 1 23 1 140 1 4 1 80 1 119 1 42 1 5 1 21 1 3 1 7 2 27 7 4 13 5 3 7 3 1 9 2 1 5 2 2 9 1 7 1 7 3 46 4 40 5 26 3 47 18 32 4 21 4 46 2 48 4 29 3 44 3 46 5 23 3 43 3 49 5 26 3 45 3 49 5 21 3 45 3 47 4 20 3 7 3 3 1 1</runs>
        <runs>0 316 1 291 1 27 1 3 1 53 2 33 1 30 1 3 2 36 4 4 1 18 1 13 2 1 3 11 1 24 1 4 1 4 4 31 2 1 3 2 6 1 5 1 1 1 4 3 9 3 3 5 6 4 15 1 13 3 44 3 46 5 23 3 43 3 49 5 26 3 45 3 49 5 21 3 45 3 47 4 30 3 46 3 4 1 4 13 3 3 2 6 1 14 1 17 1 2 1 44 1 37 3 3 5</runs>
        <runs>0 1065 1 180 1 18 3 3 1 3 1 43 1 3 2 10 2 34 1 24 2 3 1 37 2 4 1 3 1 43 3 11 5 2 16 3 46 3 47 4 19 2 46 3 45</runs>
        <runs>0 1323 1 73 1 42 1 88 1 3 1 11 3 5 3 1 12 2 3 3 2 3 47 4 19 2 46 3 45</runs>
        <runs>0 1633 2 16 1 2 1 48 1 43 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1783" id="297">
      <run-table orientation="HORIZONTAL" width="1750" height="8">
        <runs>0 2 10 6 4 5 7 4 1 1 5 5 5 6 4 3 4 64 2 3 1 2 7 26 1 3 2 3 1 43 1 4 1 21 1 3 1 4 2 14 2 1 1 10 1 16 1 1 7 5 1 11 3 2 2 12 3 6 4 4 1 2 1 6 1 3 1 1 6 1 2 1 20 7 2 1 2 3 2 2 4 10 2 5 3 3 1 2 4 1 2 2 1 5 1 21 1 3 1 96 1 155 1 256 1</runs>
        <runs>0 1 11 6 4 5 7 4 7 5 40 7 41 3 42 3 45 4 23 3 36 16 40 5 28 3 44 3 44 5 23 3 28 2 2 1 5 1 5 4 13 1 17 1 12 5 3 8 2 6 6 3 1 3 1 2 7 20 1 13 2 4 1 2 3 23 6 4 1 30 1 3 2 43 2 3 2 43 1 5 1 19 1 49 1 2 1 46 1 4 1 27 1 2 1</runs>
        <runs>0 2 10 6 4 5 7 4 7 5 40 7 41 3 42 3 45 4 23 3 36 16 40 5 28 3 44 3 44 5 23 3 44 4 44 5 29 3 46 4 40 5 26 3 47 3 46 5 21 4 46 2 48 4 29 2 45 3 1 1 4 1 3 4 6 3 2 4 9 3 5 5 2 3 1 16 1 3 1 41 1 3 1 53 1 28 1</runs>
        <runs>0 18 2 1 1 5 7 4 7 5 2 2 2 4 9 2 19 7 6 3 12 3 1 1 1 3 11 3 26 2 14 3 4 2 39 4 23 3 36 16 40 5 28 3 21 2 7 3 11 3 44 5 23 3 44 4 44 5 29 3 46 4 40 5 26 3 47 3 46 5 21 4 46 2 48 4 29 2 45 3 46 5 23 3 43 3 39 2 3 3 2 5 2 4 5 14 1 3 2 2 3 31 2 2 3 3 1 8 1 13 1 5 2 5 1 3 2 6 1 5 3 17 1 3 1 15 1 1 4 10 2 14 1 45 1 33 1 48 1 72 1</runs>
        <runs>0 760 1 3 1 49 1 50 1 24 1 2 1 41 1 2 2 9 1 35 1 4 1 20 1 1 6 2 6 1 4 3 31 3 46 5 23 3 43 3 49 5 26 3 45 3 49 5 21 3 45 3 47 4 30 3 46 3 47 4 5 2 5 3 4 2 7 14 1 22 2 3 1 5 2 7 1 1 6 1 2 2 1 1 3 2 10</runs>
        <runs>0 938 1 130 1 72 1 3 3 2 3 34 1 3 3 2 4 2 5 2 31 5 26 3 45 3 49 5 21 3 25 1 19 3 47 4 30 3 46 3 47 4 19 2 46 3 45</runs>
        <runs>0 1246 1 202 1 71 4 3 2 3 1 6 7 1 31 3 47 4 19 2 46 3 45</runs>
        <runs>0 1633 1 17 1 2 1 31 2 15 1</runs>
      </run-table>
    </glyph>
    <glyph left="126" top="1797" id="298">
      <run-table orientation="HORIZONTAL" width="1750" height="8">
        <runs>0 2 7 3 8 2 8 3 3 146 1 47 1 155 1 49 1 47 1 73 1</runs>
        <runs>20 2 14 9 19 1 15 1 1 8 40 1 7 3 22 4 6 1 9 3 2 3 5 11 1 1 14 4 4 4 1 6 1 1 1 2 11 3 1 2 89 5 29 3 43 3 43 5 19 1 10 1 4 1 4 4 5 3 3 3 3 8 2 3 1 27 2 4 4 12 1 31 1 44 1 43 1 84 1 45 1 28 1 95 1</runs>
        <runs>10 1 9 2 14 9 93 3 42 3 45 4 23 3 92 5 29 3 43 3 43 5 71 3 45 5 28 4 46 3 41 5 26 4 46 3 47 4 21 3 97 4 125 5 23 3 7 8 3 5 2 4 6 2 1 3 3 2 3 46 1 4 1 248 1</runs>
        <runs>0 2 1 24 9 9 3 40 2 47 1 23 2 23 2 4 3 16 3 14 3 4 20 1 2 3 2 3 11 4 1 3 3 5 2 7 1 1 2 20 2 1 3 9 3 8 1 9 6 6 3 9 1 3 4 1 1 4 1 41 3 12 3 2 4 3 7 2 1 6 1 1 2 13 53 3 45 5 28 4 46 3 41 5 26 4 46 3 47 4 21 3 97 4 125 5 23 3 96 4 20 7 33 1 25 1 1 2 24 1 11 5 17 1 26 2 8 3 2 1 2 14 4 2 1 3 2 10 6 1 2 1 2 6 3</runs>
        <runs>0 35 1 604 1 118 2 4 1 41 2 5 6 25 3 1 2 20 2 2 4 4 3 3 15 3 3 6 8 1 23 1 25 1 2 1 8 4 125 5 23 3 96 4 126 5 119 4 68 2 8 73 1 92 4</runs>
        <runs>0 995 1 43 4 12 2 6 17 1 9 2 3 1 9 3 7 5 2 2 7 3 9 3 96 4 126 5 119 4 129 4 19 2 2 1 10 4 3 2 21 2 1 1 4 4 1 1 37</runs>
        <runs>0 1529 3 11 86 4 19 2 94</runs>
        <runs>0 1615 1 5 8 4 19 2 72 1 9 4 4 1 3</runs>
      </run-table>
    </glyph>
    <glyph left="127" top="1910" id="299">
      <run-table orientation="HORIZONTAL" width="1747" height="10">
        <runs>0 81 1</runs>
        <runs>0 78 4</runs>
        <runs>0 1 14 1 1 4 4 1 1 4 1 13 2 26 1 4 4 57 1 62 2 107 1 35 1 82 1 37 1 15 1 55 1 93 1</runs>
        <runs>27 4 3 11 29 4 4 6 33 7 12 16 27 19 24 4 19 18 24 20 23 5 9 7 10 17 28 20 26 4 9 6 10 17 30 4 5 3 41 4 46 4 54 4 15 4 34 4 32 3 26 2 18 3 8 2 1 4 1 3 3 2 2 4 2 5 10 1 1 2 2 2 1 13 1 5 1 11 2 11 1 28 4 24 1 9 1 6 2</runs>
        <runs>0 1 26 4 3 11 29 4 4 6 33 7 12 16 27 19 21 1 2 4 19 18 24 20 23 5 9 7 10 17 28 20 26 4 9 6 10 17 30 4 5 3 41 4 46 4 54 4 15 4 34 4 32 3 46 3 32 5 19 4 29 11 3 17 17 20 19 16 20 4 21 17 26 3 31 6 26 2 27 1 4 18 2 2 2 3 1 19 2 52 3 1 6 1 5 3 20 2 3 1 2 6 1 4 2 30 1 20 1 36 1</runs>
        <runs>0 31 1 46 1 9 1 50 1 42 1 47 1 59 1 20 1 20 2 30 1 44 1 50 1 23 1 46 1 4 1 3 1 3 1 38 2 4 2 34 1 8 1 4 2 10 7 3 4 5 23 4 15 4 34 4 32 3 46 3 32 5 19 4 29 11 3 17 17 20 19 16 20 4 21 17 26 3 31 6 63 5 20 19 18 16 91 4 32 4 34 3 32 3 15 23 1 63 1</runs>
        <runs>0 333 1 455 1 44 1 91 1 47 1 30 2 5 2 16 7 2 5 2 4 4 21 17 26 3 31 6 63 5 20 19 18 16 91 4 32 4 34 3 32 3 15 23 27 4 30 3 33 5 1 66 37</runs>
        <runs>0 974 1 117 1 20 3 104 1 59 3 16 1 89 1 4 1 19 12 4 1 24 9 3 6 2 10 1 2 2 4 2 3 3 3 3 9 23 27 4 30 3 33 5 1 66 37</runs>
        <runs>0 1467 1 34 1 37 1 12 1 3 4 1 5 4 30 3 33 5 1 66 37</runs>
        <runs>0 1600 1 140 2 2 1</runs>
      </run-table>
    </glyph>
    <glyph left="127" top="1924" id="300">
      <run-table orientation="HORIZONTAL" width="1747" height="11">
        <runs>0 78 1</runs>
        <runs>0 12 1 64 2 12 1 600 1</runs>
        <runs>0 1 17 21 1 2 1 2 15 4 10 3 2 7 1 4 3 9 3 6 3 22 2 9 3 2 1 8 2 8 3 6 1 3 1 14 1 6 2 1 5 5 1 4 1 4 7 56 1 25 1 13 1 8 4 4 4 22 2 15 2 3 4 1 3 1 2 4 5 3 1 2 3 1 2 1 2 3 4 1 6 1 1 3 4 5 2 7 3 15 1 94 2 33 1 14 2 56 2 4 1</runs>
        <runs>18 21 21 4 10 3 2 3 5 4 48 4 39 3 41 4 16 17 27 3 20 1 20 5 25 4 41 4 43 5 23 4 52 4 41 5 45 4 54 4 15 4 17 1 16 4 32 4 23 3 12 3 3 4 1 7 8 2 10 3 1 5 10 2 7 19 1 4 3 3 1 4 4 7 1 4 1 32 1 2 2 3 2 40 1 173 1</runs>
        <runs>0 1 17 21 21 4 10 3 2 3 5 4 48 4 39 3 41 4 16 17 27 3 41 5 25 4 41 4 43 5 23 4 52 4 41 5 45 4 54 4 15 4 34 4 32 4 44 4 32 5 19 4 35 5 3 4 29 4 32 18 22 4 18 22 1 1 1 3 2 26 1 13 2 58 2 17 1 4 1 9 1 8 1 115 1 2 1 24 1 4 1 34 1</runs>
        <runs>0 91 1 45 2 42 1 43 1 4 1 36 8 3 3 3 1 4 1 3 1 1 1 2 12 103 1 101 3 8 3 5 5 5 2 3 2 1 8 1 2 4 18 5 1 1 6 4 8 2 20 1 2 4 1 1 43 1 2 1 5 4 2 1 10 1 1 4 34 4 32 4 44 4 32 5 19 4 35 5 3 4 29 4 32 18 22 4 18 18 19 19 20 17 18 19 20 4 20 3 31 17 66 1 26 4 16 19 21 17 32 4 19 4 3 3 5 4 1 10 1 6 1 2 1 41 1 32 1</runs>
        <runs>0 555 4 75 1 62 1 56 1 72 2 46 1 16 2 6 2 2 4 1 9 2 5 2 6 5 3 4 20 1 1 2 5 4 32 18 22 4 18 18 19 19 20 17 18 19 20 4 20 3 31 17 66 1 26 4 16 19 21 17 32 4 34 4 25 6 15 17 7 5 22 3 6 2 3 1 1 1 2 1 18 4 15 3 5 1 6 6 1 1 1 3 11 2 7 3 1</runs>
        <runs>0 556 2 491 1 4 1 16 1 22 15 19 20 17 12 3 3 19 13 3 1 2 1 4 20 3 31 17 50 2 6 2 6 1 26 4 16 19 21 17 32 4 34 4 25 6 15 17 34 3 35 4 30 6 30</runs>
        <runs>0 1108 1 136 1 318 2 6 15 17 34 3 35 4 30 6 30</runs>
        <runs>0 1623 1 9 5 3 2 1 4 3 2 2 1 4 3 4 2 3 4 4 7 2 6 2 2 4 7 6 30</runs>
        <runs>0 1745 1</runs>
      </run-table>
    </glyph>
    <glyph left="127" top="1940" id="301">
      <run-table orientation="HORIZONTAL" width="1747" height="9">
        <runs>0 7 4 49 1 30 4 86 1 43 1 4 1 18 1 84 1 74 1 74 1 104 1 142 1 20 1</runs>
        <runs>11 35 15 3 2 8 13 4 4 7 23 2 12 4 39 3 26 3 5 2 5 4 11 3 2 3 2 5 2 2 2 27 1 3 2 10 3 5 15 2 5 4 25 4 10 1 31 3 43 5 17 1 6 3 16 3 11 1 1 10 3 2 2 2 1 4 3 16 3 9 1 8 1 4 3 9 4 2 2 4 2 5 4 6 4 10 1 9 2 13 2 9 2 10 1 4 1 34 1 20 1 31 1 3 1 103 1 46 1 393 1</runs>
        <runs>11 35 15 3 2 8 13 4 4 7 37 4 39 3 27 1 13 4 16 3 41 3 42 4 25 4 42 3 43 5 24 3 52 4 41 4 45 10 1 9 39 4 15 20 18 3 33 3 45 4 32 5 19 18 29 4 29 4 32 4 36 4 18 4 32 4 1 7 9 1 3 2 10 18 1 3 3 2 11 3 1 1 4 1 2 1 3 3 4 5 10 6 1 3 8 1 1 3 1 4 1 4 4 20 2 3 1 29 3 18 2 1 24</runs>
        <runs>0 10 1 49 1 3 2 8 4 2 1 5 1 4 4 28 1 2 1 4 8 7 8 1 1 1 6 4 6 1 1 3 4 3 7 2 4 1 2 5 4 8 1 5 2 4 1 4 2 6 3 3 41 3 18 2 7 2 2 10 1 4 1 15 3 4 2 4 9 6 3 22 2 3 4 22 2 3 2 2 1 1 2 9 1 4 5 4 2 4 4 3 52 4 41 4 45 10 1 9 39 4 15 20 18 3 33 3 45 4 32 5 19 18 29 4 29 4 32 4 36 4 18 4 32 4 33 18 20 3 35 6 18 4 31 3 33 18 55 5 29 1 7 4 1 5 7 27 2 25 2 32 1</runs>
        <runs>0 91 1 153 1 163 1 179 1 102 1 60 1 31 1 3 1 48 1 54 1 35 1 2 2 5 2 4 1 6 1 25 1 15 2 10 4 4 16 1 19 4 2 6 10 4 32 4 33 18 20 3 35 6 18 4 31 3 33 18 55 5 29 1 24 16 21 17 35 4 25 5 14 16 20 20 36 3 32 5 10 3 2 1 8 1 4</runs>
        <runs>0 1071 1 35 1 4 3 5 6 18 1 22 1 14 1 3 1 57 1 6 3 1 3 4 1 3 1 7 3 1 2 3 17 3 2 1 2 6 2 71 2 5 1 2 3 1 22 1 24 16 21 17 35 4 25 5 14 16 20 20 36 3 32 5 29</runs>
        <runs>0 1315 1 72 1 31 3 79 1 33 1 4 1 4 20 5 14 16 20 20 36 3 32 5 29</runs>
        <runs>0 1421 2 148 1 7 1 4 1 16 10 1 9 20 14 1 21 3 32 5 29</runs>
        <runs>0 1745 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="1953" id="302">
      <run-table orientation="HORIZONTAL" width="1749" height="10">
        <runs>0 12 1 76 1 51 1 2 1 508 1 56 1</runs>
        <runs>0 2 11 6 4 5 7 4 2 10 4 21 1 12 1 50 2 2 1 38 1 43 1 4 1 18 1 84 1 4 5 24 1 9 1 26 2 2 1 3 1 2 3 6 4 2 2 5 8 3 7 5 3 13 1 173 3 52 4</runs>
        <runs>13 6 4 5 7 4 6 6 39 8 44 2 40 3 41 4 16 3 15 5 6 2 5 3 1 2 2 3 2 3 37 4 26 3 42 3 43 5 24 3 97 4 35 1 2 5 2 4 4 1 13 8 1 1 2 2 22 13 7 41 1 31 1 3 1 84 1</runs>
        <runs>0 1 12 6 4 5 7 4 6 6 39 8 44 2 40 3 41 4 16 3 41 3 42 4 26 3 42 3 43 5 24 3 97 4 45 4 20 6 28 10 10 4 34 3 33 3 45 4 32 4 41 99 35 5 18 4 4 3 3 6 1 51 1 3 4 16 1 94 1 50 1 3 1</runs>
        <runs>0 19 2 7 1 2 4 4 2 10 1 46 2 87 1 39 1 4 1 14 1 3 1 1 3 13 10 1 3 2 3 3 1 3 3 1 1 1 1 2 5 27 1 25 1 24 2 21 2 3 1 47 1 8 1 1 1 4 1 17 1 4 4 1 1 8 2 6 3 7 2 5 1 1 5 1 1 3 7 1 6 1 1 4 14 4 45 4 20 6 28 10 10 4 34 3 33 3 45 4 32 4 41 99 35 5 18 4 32 4 33 3 34 4 35 6 18 4 30 4 32 3 35 19 18 4 69 1 7 5 1 3 3 111 1</runs>
        <runs>0 295 1 290 1 4 1 64 4 11 1 4 1 9 1 5 2 10 5 27 1 14 1 3 1 30 2 3 1 19 3 11 3 6 2 4 1 30 1 4 2 18 8 2 2 2 7 99 35 5 18 4 32 4 33 3 34 4 35 6 18 4 30 4 32 3 35 19 18 4 89 17 24 17 9 1 15 5 20 3 2 9 6 4 19 9 1 7 2 27 1 30 1 3 1</runs>
        <runs>0 658 2 44 2 129 1 40 1 170 2 7 1 15 2 4 4 2 3 1 4 3 15 4 33 3 34 4 28 3 4 6 18 4 30 4 32 3 35 19 18 4 89 17 24 17 25 5 20 3 3 6 57 20 32 3 30</runs>
        <runs>0 1320 1 70 1 4 2 6 2 4 7 2 11 3 1 3 48 17 24 17 25 5 20 3 3 6 57 20 32 3 30</runs>
        <runs>0 1573 1 22 3 16 3 6 1 3 31 1 2 23 3 2 24 3 30</runs>
        <runs>0 1598 1 114 1 3 1 20 4 2 3</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="1966" id="303">
      <run-table orientation="HORIZONTAL" width="1749" height="10">
        <runs>0 42 1</runs>
        <runs>0 25 2 14 2</runs>
        <runs>0 25 4 6 1 5 2 298 1</runs>
        <runs>0 1 18 6 11 5 2 2 37 3 43 1 3 1 1 1 6 1 6 1 2 1 45 1 25 1 4 4 16 3 3 3 3 22 3 5 1 3 3 2 4 3 1 3 27 4 118 4 66 3 9 2 4 1 4 9 4 15 7 4 4 16 2 3 2 7 2 8 1 3 1 2 1 36 1 13 1 529 1</runs>
        <runs>19 6 11 5 2 2 183 4 16 3 86 4 118 4 124 4 45 3 55 5 15 4 27 95 32 4 129 2 3 4 5 14 4 11 3 4 3 8 2 1 5 149 1 4 1 87 1 37 1 3 1 32 1</runs>
        <runs>0 16 3 6 11 5 1 20 5 2 12 2 8 1 2 1 2 1 2 2 1 9 2 8 1 9 4 14 2 3 4 2 8 5 2 3 6 12 5 2 6 1 10 6 1 5 10 2 3 3 11 2 45 2 3 4 1 3 6 2 7 20 3 1 2 2 14 5 5 1 10 11 2 35 2 4 1 9 4 3 5 1 14 1 3 3 4 1 5 2 26 1 50 4 45 3 55 5 15 4 27 95 32 4 175 4 19 114 36 4 19 46 24 3 35 3 34 4 18 19 4 3 6</runs>
        <runs>0 635 1 3 1 7 15 2 1 5 8 1 15 5 15 4 27 95 32 4 175 4 19 114 36 4 19 46 24 3 35 3 34 4 119 25 1 26 1 179 1</runs>
        <runs>0 1293 14 9 1 3 3 6 6 7 4 5 4 3 1 4 3 3 1 3 2 1 2 4 10 4 127 17 28 4 125 20 31</runs>
        <runs>0 1436 1 10 2 12 62 17 28 4 125 20 31</runs>
        <runs>0 1573 3 4 117 20 31</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2097" id="304">
      <run-table orientation="HORIZONTAL" width="1749" height="10">
        <runs>0 81 1</runs>
        <runs>0 74 1 4 3 147 1 94 1 49 1 38 1 173 1 316 1</runs>
        <runs>30 5 2 11 27 4 3 7 94 5 4 3 35 3 33 4 32 4 19 3 37 1 4 4 4 3 33 3 32 3 36 4 16 3 37 3 37 3 42 3 10 1 12 2 7 4 13 4 4 3 2 6 18 17 20 21 18 18 19 5 16 18 22 1 4 3 19 3 14 2 26 3 14 1 4 6 1 18 6 25 1 37 6 5 3 5 1 4 4 11 3 5 1 7 6 2 1 7 4 3 10 29 4 1 2 2 11 4 7 10 2 12 2 4 1</runs>
        <runs>30 5 2 11 27 4 3 7 95 4 4 3 35 3 33 4 32 4 19 3 37 1 4 4 4 3 33 3 32 3 36 4 16 3 37 3 37 3 42 3 32 4 13 4 33 17 20 21 18 18 19 5 16 18 27 3 36 2 63 5 17 19 20 18 97 5 35 4 33 4 33 44 1</runs>
        <runs>0 9 11 9 1 5 2 37 1 4 3 7 1 47 3 24 2 2 5 2 2 1 6 4 4 3 35 3 33 4 32 4 19 3 37 1 4 4 4 3 33 3 3 1 9 1 18 3 36 4 16 3 37 3 37 3 42 3 32 4 13 4 33 17 20 21 18 18 19 5 16 18 27 3 36 2 63 5 17 19 20 18 97 5 35 4 33 4 33 44 32 4 37 3 33 3 2</runs>
        <runs>0 79 1 115 1 37 1 19 1 11 1 4 1 35 2 20 1 45 2 1 1 3 1 31 1 38 1 34 1 4 1 14 1 43 1 35 1 3 2 3 2 15 1 3 1 14 1 3 2 2 4 3 2 2 12 2 3 4 13 4 33 17 20 21 13 2 1 1 1 18 1 1 17 5 16 18 27 3 36 2 63 5 17 19 20 18 97 5 35 4 33 4 33 44 32 4 37 3 38 64 49 4 14 7 1 79 1 36 1</runs>
        <runs>0 721 1 282 1 257 1 76 1 30 1 4 1 21 4 1 10 3 38 64 49 4 98 3 38 3 35</runs>
        <runs>0 1415 2 124 1 22 2 4 3 3 8 1 1 1 81 3 38 3 35</runs>
        <runs>0 1653 15 3 2 3 33 3 11 2 12 2 8</runs>
        <runs>0 1671 1 36 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2112" id="305">
      <run-table orientation="HORIZONTAL" width="1749" height="8">
        <runs>0 8 8 1 3 22 1 4 2 11 1 7 4 3 1 12 1 4 1 1 3 29 1 63 1 3 1 33 1 3 1 72 1 16 1 3 1 84 1 3 1 31 1 2 2 33 2 4 1 12 2 48 1 7 2 26 1 80 1 161 1</runs>
        <runs>0 1 19 22 19 5 10 7 6 4 99 3 13 2 20 3 30 1 1 4 2 30 1 4 2 5 3 5 3 3 34 2 1 2 11 4 11 1 20 3 33 2 37 4 15 4 35 6 23 2 10 4 16 2 17 3 3 4 2 9 2 1 3 7 7 5 2 9 2 4 1 5 2 22 2 4 2 22 1 1 2 2 3 5 5 6 1 20 1 18 4 2 1 5 3 5 1 5 1 72 1 96 1 14 1 161 1 36 1 37 1 33 1</runs>
        <runs>0 1 19 22 19 5 10 7 6 4 99 3 35 3 32 4 33 4 18 3 50 4 32 3 33 2 37 4 15 4 35 6 35 4 41 4 31 5 13 4 32 4 33 5 33 18 21 5 13 19 21 20 19 18 16 20 19 5 16 4 34 18 99 6 17 20 21 17 35 3 35 40 1</runs>
        <runs>0 1 19 22 19 5 10 7 6 4 99 3 35 3 32 4 33 4 18 3 50 4 32 3 33 2 37 4 15 4 35 6 35 4 41 4 31 5 13 4 32 4 33 5 33 18 21 5 13 19 21 20 19 18 16 20 19 5 16 4 34 18 99 6 17 20 21 17 35 3 35 4 25 1 6 4 4 1 3 13 1 18 1 40 1 31 3 4 1 36 1 31 2 4 1</runs>
        <runs>0 191 1 37 1 39 1 36 1 16 1 124 1 2 1 40 1 93 1 85 1 16 1 35 1 37 9 2 3 18 1 56 1 38 2 57 1 14 1 20 1 5 1 2 1 2 7 5 16 4 34 18 48 1 3 2 26 1 1 2 10 3 2 6 1 2 14 20 21 17 35 3 35 4 32 4 22 18 38 3 35 4 18 19 34 4 78 1 3 1 4 10 1 3 1</runs>
        <runs>0 892 1 117 1 52 1 232 1 11 2 7 1 13 4 8 1 4 23 4 22 18 38 3 35 4 18 19 34 4 98 3 37 4 35</runs>
        <runs>0 1375 1 39 1 40 1 108 1 4 1 25 3 4 6 1 58 3 37 4 35</runs>
        <runs>0 1635 1 3 1 1 4 2 2 3 2 2 12 3 37 4 35</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2125" id="306">
      <run-table orientation="HORIZONTAL" width="1749" height="10">
        <runs>0 75 1 431 1</runs>
        <runs>0 75 1 19 2 227 1 181 2 556 1</runs>
        <runs>0 2 11 36 12 5 2 7 11 2 1 4 4 7 7 1 11 3 23 3 1 2 17 18 2 77 1 7 3 22 1 20 2 126 3 1 13 1 3 1 5 2 8 5 15 127 1 30 1 5 1 21 2 24 1 4 2 35 1 32 1 3 1 34 1 5 1 11 1 38 1 55 1 17 1 44 1 14 1 37 2 116 1 5 1</runs>
        <runs>0 2 11 36 12 5 2 7 14 4 4 7 45 3 40 77 34 4 18 126 37 5 15 127 32 5 13 8 28 4 33 4 34 3 36 5 13 4 35 4 34 17 19 3 36 5 16 4 35 3 35 19 60 5 29 2 24 16 24 18 35 4 22 8 2 11 1</runs>
        <runs>0 5 8 36 4 2 1 4 1 14 6 7 1 4 4 7 7 3 2 3 1 1 3 3 5 4 13 3 40 77 34 4 18 126 37 5 15 127 32 5 13 8 28 4 33 4 34 3 36 5 13 4 35 4 34 17 19 3 36 5 16 4 35 3 35 19 60 5 29 2 24 16 24 18 35 4 32 5 20 16 10 6 9 19 1 10 3 2 19 4 1 7 1 11 2 9 2 4 3 8 2 15 1 9 1</runs>
        <runs>0 93 1 54 1 153 1 21 1 126 1 35 1 5 1 141 2 35 2 23 1 2 4 12 1 3 1 4 1 31 1 4 4 2 4 23 1 3 1 34 1 5 1 16 1 3 2 27 2 4 3 29 2 29 3 1 3 3 4 3 4 2 5 1 2 2 7 4 2 5 16 4 35 3 5 1 13 2 14 19 39 1 20 5 29 2 24 16 24 18 35 4 32 5 20 16 25 19 35 4 33 4 33 5 46 2 4 2 5 79 1</runs>
        <runs>0 672 1 292 1 136 1 110 3 160 1 2 4 3 1 1 8 16 25 19 35 4 33 4 33 5 59 19 20 3 38 3 35</runs>
        <runs>0 1214 2 220 1 90 1 4 1 31 1 5 1 21 6 6 25 19 20 3 38 3 35</runs>
        <runs>0 1628 1 19 20 3 38 3 35</runs>
        <runs>0 1671 1 74 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2140" id="307">
      <run-table orientation="HORIZONTAL" width="1749" height="9">
        <runs>0 12 1 10 1 82 1 41 1 9 1 143 1 4 1 184 1</runs>
        <runs>0 2 11 7 4 5 6 4 6 7 38 7 52 9 2 4 49 1 71 1 1 1 15 4 68 2 10 1 2 1 97 4 106 3 22 6 29 6 3 6 3 3 7 1 1 111 3 1 8 1 15 4 1 2 1 5 2 7 4 3 2 32 2 4 1 4 4 12 2 9 1 4 3 1 2 25 1 3 2 61 3 11 3 53 1 59 1 19 1 5 1</runs>
        <runs>0 1 12 7 4 5 6 4 6 7 38 7 52 9 2 4 139 4 181 4 175 6 15 111 36 5 13 3 21 4 11 4 33 4 32 3 37 6 15 4 12 1 20 5 7 6 21 4 35 20 21 5 14 3 3 3 6 4 6 3 1 1 10 68 2 28 1 35 1 152 1</runs>
        <runs>0 2 11 7 4 5 6 4 6 7 38 7 52 9 2 4 139 4 181 4 175 6 15 111 36 5 13 3 21 4 11 4 33 4 32 3 37 6 15 4 33 5 34 4 35 20 21 5 93 18 24 17 32 4 26 2 6 10 1 19 2 33 1 19 1 31 3 3 4 28 1 63 1</runs>
        <runs>0 39 1 118 2 147 1 184 1 86 1 79 1 20 1 118 1 33 2 5 3 8 2 3 10 7 4 4 8 2 1 4 6 2 1 2 22 4 32 3 37 6 15 4 33 5 34 4 35 20 21 5 93 18 24 17 32 4 39 5 22 1 33 19 35 3 33 5 42 8 4 2 3 3 1 38 1 36 1</runs>
        <runs>0 159 1 808 1 55 2 42 1 2 1 109 1 5 1 42 2 46 2 59 1 4 2 5 20 4 39 5 22 1 33 19 35 3 33 5 59 3 36 3 38 4 34</runs>
        <runs>0 1025 1 349 1 26 1 5 6 5 5 2 2 9 4 1 13 2 5 2 1 7 3 19 17 2 16 3 33 5 59 3 36 3 38 4 34</runs>
        <runs>0 1412 2 214 1 3 1 7 3 4 3 1 17 3 38 4 34</runs>
        <runs>0 1708 1 15 2 11 1 7 2</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2153" id="308">
      <run-table orientation="HORIZONTAL" width="1749" height="10">
        <runs>0 25 2</runs>
        <runs>0 25 3 8 1 111 1 3 1 10 1 328 1</runs>
        <runs>0 5 17 3 12 9 36 2 65 3 12 4 11 1 9 6 1 1 1 8 4 12 23 4 9 19 1 8 1 4 1 7 4 4 20 5 6 3 3 1 11 27 1 1 1 11 1 13 7 1 1 3 4 1 4 3 26 2 25 4 33 1 33 1 4 4 2 12 5 4 2 4 2 5 2 6 2 25 2 31 1 27 3 88 1 42 1 133 1 40 1</runs>
        <runs>0 3 19 3 12 9 103 3 12 4 135 4 181 4 176 4 163 5 13 115 37 4 4 1 11 44 3 1 11 3 2 4 1 2 6 4 1 9 2 2 5 14 1 7 8 23 4 5 1 89 2 40 1 55 1</runs>
        <runs>0 4 18 3 12 9 56 2 20 24 1 3 4 6 2 4 7 1 127 4 181 4 176 4 163 5 13 115 37 4 16 44 33 4 34 4 38 5 101 5 27 17 34 4 36 1 5 1 2 2 21 4 8 2 2 2 6 3 34 2 6 20 7 3 2 4 1</runs>
        <runs>0 15 1 3 1 14 3 115 1 95 2 3 1 24 1 2 2 7 2 69 2 23 2 24 5 140 1 1 5 11 3 8 3 16 3 11 2 2 1 1 8 5 18 1 3 2 2 3 1 4 134 2 3 3 1 5 15 5 13 115 37 4 16 44 33 4 34 4 38 5 101 5 27 17 34 4 137 20 32 6 15 5 5 33 1</runs>
        <runs>0 968 1 132 1 248 2 15 4 4 137 20 32 6 59 3 36 3 38 4 34</runs>
        <runs>0 1417 4 7 3 16 2 6 1 86 3 2 17 6 59 3 36 3 38 4 34</runs>
        <runs>0 1618 4 2 5 3 36 3 38 4 34</runs>
        <runs>0 1628 1 27 3 6 3 3 2 7 7 1 11 2 8 4 34</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2312" id="309">
      <run-table orientation="HORIZONTAL" width="1742" height="9">
        <runs>0 30 1 49 3 66 5 95 4 77 1 113 1 120 1 89 1</runs>
        <runs>0 1 3 2 7 15 3 4 1 12 1 14 1 10 1 4 4 18 5 2 4 2 1 2 23 9 5 7 1 3 2 4 1 1 3 2 4 2 13 5 9 4 9 5 1 8 2 9 5 6 2 11 2 6 2 5 2 40 3 27 1 11 1 10 4 57 1 35 1 33 1 46 1 2 2 86 4 85 2</runs>
        <runs>31 4 2 11 27 4 4 6 51 9 5 4 39 4 39 9 5 4 25 5 31 11 4 3 29 5 18 19 15 21 16 20 14 20 14 4 25 4 5 9 38 5 29 5 4 9 32 5 32 5 4 9 32 5 14 22 17 4 31 4 34 4 34 5 16 4 96 6 43 77 1 61 1</runs>
        <runs>0 1 30 4 2 11 27 4 4 6 51 9 5 4 39 4 20 1 18 9 5 4 25 5 31 11 4 3 29 5 18 19 15 21 16 20 14 20 14 4 25 4 5 9 38 5 29 5 4 9 32 5 32 5 4 9 32 5 14 22 17 4 31 4 34 4 34 5 16 4 96 6 49 4 29 5 12 1 18 2 23 3 9 5 7 4 4 2 2 3 4 3 2 27 1 4 1 118 1</runs>
        <runs>0 29 2 4 2 42 1 1 2 6 2 58 2 2 1 42 1 4 1 37 1 9 1 3 1 4 1 23 1 47 1 1 2 3 2 32 1 16 1 33 1 21 2 11 3 20 1 11 2 20 7 3 2 1 1 4 3 19 3 4 5 9 10 1 16 2 9 5 29 5 4 9 32 5 32 5 4 9 32 5 14 22 17 4 31 4 34 4 34 5 16 4 96 6 49 4 29 5 31 2 35 5 19 3 90 4 46 20 5 8 3 19 1</runs>
        <runs>0 337 1 33 1 87 1 33 1 38 1 23 1 61 1 49 8 19 2 5 2 3 1 75 1 5 1 1 1 33 1 12 4 4 10 3 3 3 2 1 9 4 34 4 34 5 16 4 47 2 47 6 49 4 29 5 31 2 35 5 19 3 90 4 46 20 16 19 14 20 2 2 1 4 6 7 2 42 5 2 1 1 1 2 2 9 1</runs>
        <runs>0 1128 1 67 2 2 1 61 1 24 3 3 18 2 27 1 11 4 2 1 19 1 5 1 17 20 16 19 14 20 16 3 20 18 74 4 33 1 10 10 5 2 4 24 2 5 4 3 6</runs>
        <runs>0 1197 1 158 1 65 1 34 1 2 4 2 5 20 16 3 20 18 74 4 109</runs>
        <runs>0 1504 3 3 1 50 5 8 2 10 2 4 5 4 21 4 109</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2325" id="310">
      <run-table orientation="HORIZONTAL" width="1742" height="10">
        <runs>0 145 1 95 1 3 1 79 1</runs>
        <runs>0 62 1 3 1 75 4 50 1 4 1 35 1 3 5 35 1 39 1 2 2 201 1 28 1</runs>
        <runs>0 1 20 22 20 3 10 8 4 4 46 4 4 10 41 4 37 3 5 9 27 6 29 4 5 8 32 6 15 18 18 3 33 4 31 3 31 4 25 4 52 5 29 4 46 5 3 2 11 1 6 5 2 1 1 4 14 7 2 1 3 2 2 3 1 16 1 17 1 1 1 16 1 8 1 4 2 3 1 7 8 6 2 45 1 36 2 20 1 4 1 8 2</runs>
        <runs>21 22 20 3 10 8 4 4 46 4 4 10 41 4 37 3 5 9 27 6 29 4 5 8 32 6 15 18 18 3 33 4 31 3 31 4 25 4 52 5 29 4 46 5 32 4 46 5 14 4 14 5 16 3 31 5 34 4 34 6 15 4 55 13 28 6 15 8 7 4 7 7 1 4 2 65 1 33 1 5 1</runs>
        <runs>0 1 20 22 20 3 10 8 1 1 2 4 46 4 4 10 22 3 7 2 3 3 1 4 2 2 5 2 2 3 5 3 13 3 5 9 16 2 1 1 7 6 29 4 5 8 13 1 18 6 15 18 18 3 33 4 31 3 31 4 25 4 52 5 29 4 46 5 32 4 46 5 14 4 14 5 16 3 31 5 34 4 34 6 15 4 55 13 28 6 15 8 7 2 17 4 29 5 30 3 35 5 19 4 34 2 7 2 3 3 2 9 2 1 5 18 1</runs>
        <runs>0 62 1 133 1 4 1 35 1 78 1 109 1 31 1 4 1 29 1 3 1 29 1 4 1 28 1 56 1 26 2 4 2 3 41 5 19 4 2 2 5 4 2 3 2 3 32 1 3 5 14 4 14 5 5 2 9 3 31 5 34 4 34 6 15 4 55 13 28 6 15 8 7 2 17 4 29 5 30 3 35 5 19 4 53 9 27 4 13 9 5 3 16 4 31 4 19 1 10 4 5 2 11 12 1 4 3 16 1 3 1 7 1 17 2 60 1</runs>
        <runs>0 914 1 58 1 4 1 149 1 4 1 1 12 2 4 5 1 1 2 5 13 3 14 3 35 5 19 4 53 9 27 4 13 9 5 3 16 4 31 4 30 4 31 4 20 3 53 10 26 5 7 2 8 1 4 35 3 6 1 11 1 26 1</runs>
        <runs>0 1200 1 39 1 17 1 37 2 5 3 4 1 2 1 11 4 2 21 4 13 9 5 3 16 4 31 4 30 4 31 4 20 3 53 10 26 5 45 10 46 3 3</runs>
        <runs>0 1470 1 4 1 29 1 4 1 18 1 3 1 6 1 4 1 15 2 33 26 5 45 10 46 3 3</runs>
        <runs>0 1510 1 110 1 5 45 10 46 3 3</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2339" id="311">
      <run-table orientation="HORIZONTAL" width="1742" height="11">
        <runs>0 93 2 291 1</runs>
        <runs>0 5 2 1 1 5 1 52 2 8 1 14 3 12 8 4 1 8 5 3 2 4 1 11 2 11 7 7 2 13 1 5 1 14 1 23 1 4 1 3 3 11 1 16 1 24 1 9 1 3 1 31 1 32 2 20 1 18 1 36 1 29 1 3 1 34 1 23 1</runs>
        <runs>0 1 14 34 14 4 2 8 11 4 3 7 36 4 55 5 35 4 41 6 29 3 46 6 15 4 10 6 15 4 33 4 31 3 30 5 25 4 52 6 28 4 43 1 2 5 1 5 1 6 1 4 6 4 4 4 10 17 2 35 1 38 1 21 1 12 1 21 1 16 1 20 1 21 1 82 1 31 1</runs>
        <runs>0 1 14 34 14 4 2 8 11 4 3 7 36 4 55 5 35 4 41 6 29 3 46 6 15 4 10 6 15 4 33 4 31 3 30 5 25 4 52 6 28 4 46 5 32 4 46 5 14 16 23 21 14 21 12 4 2 20 17 5 16 22 7 2 26 10 33 6 16 14 2 50 1 34 1 20 1</runs>
        <runs>0 5 2 6 2 34 1 17 2 23 3 7 2 33 1 58 1 39 1 4 1 46 1 27 1 3 2 43 1 6 1 13 1 4 1 7 2 6 4 4 7 4 13 2 18 4 4 3 24 3 4 2 10 1 13 5 25 4 52 6 28 4 46 5 32 4 46 5 14 16 23 21 14 21 18 20 17 5 16 22 35 10 33 6 16 14 19 21 13 20 15 20 17 5 19 21 31 12 29 4 14 14 16 6 1 1 10 18 1</runs>
        <runs>0 14 1 77 1 9 1 217 1 105 1 36 1 29 1 3 1 28 1 5 1 28 1 50 1 29 3 1 1 4 1 5 3 9 5 11 4 5 3 5 1 25 2 3 1 4 4 1 2 2 14 5 6 2 10 5 6 2 6 16 23 21 14 21 18 20 17 5 16 22 35 10 33 6 16 14 19 21 13 20 15 20 17 5 19 21 31 12 29 4 14 14 18 4 31 4 14 1 7 6 2 6 2 2 1 10 2 10 2 27 1</runs>
        <runs>0 738 1 102 1 34 1 38 1 20 1 15 1 5 2 81 1 38 1 47 1 32 2 20 15 20 17 5 19 21 31 12 29 4 14 14 18 4 31 4 30 4 31 5 19 3 49 10 30 5 1 3 3 3 8 26 1 62 1</runs>
        <runs>0 1162 1 34 1 153 1 4 1 3 1 4 1 2 1 15 6 1 3 4 2 1 1 4 31 4 30 4 31 5 19 3 49 10 30 5 45 9 47 3 4</runs>
        <runs>0 1436 1 11 2 20 1 4 1 29 1 5 1 16 2 3 4 16 2 3 4 17 3 10 30 5 45 9 47 3 4</runs>
        <runs>0 1612 2 5 3 5 45 9 47 3 4</runs>
        <runs>0 1734 1</runs>
      </run-table>
    </glyph>
    <glyph left="125" top="2353" id="312">
      <run-table orientation="HORIZONTAL" width="1742" height="10">
        <runs>0 141 1</runs>
        <runs>0 13 1 16 1 21 1 84 1 3 1 54 1 39 1 4 1 40 1 33 1 55 1 124 1 120 1 28 1</runs>
        <runs>0 1 4 2 2 3 2 7 3 6 6 5 2 1 1 7 12 7 6 19 42 3 14 1 26 1 14 5 35 4 42 5 29 3 2 1 43 6 14 16 21 74 2 27 1 5 1 19 2 3 1 3 1 56 2 26 2 3 1 44 1 5 1 30 1 4 1 44 1 57 1 34 1 38 1 3 1 32 1 5 1 19 1 50 1</runs>
        <runs>14 7 3 6 6 5 4 7 36 8 42 3 56 5 35 4 42 5 29 3 46 6 14 16 21 74 30 5 26 3 52 5 30 3 46 5 32 4 46 5 14 5 34 3 32 4 35 3 34 5 16 4 52 9 2 5 28 5 23 4 23 4 7 2 8 16 1 4 7 1 2 13 4 11 3 28 1 17 1 65 2 49 1</runs>
        <runs>0 1 13 7 3 6 6 5 4 7 36 8 42 3 11 6 11 2 6 3 9 2 3 2 1 5 24 1 10 4 42 5 10 1 18 3 46 6 14 16 21 74 30 5 26 3 52 5 30 3 46 5 32 4 46 5 14 5 34 3 32 4 35 3 34 5 16 4 52 9 2 5 28 5 23 4 23 4 29 4 32 3 34 5 19 4 28 6 3 2 3 3 2 14 3 24 1 4 1 17 2 4 1</runs>
        <runs>0 35 1 16 1 143 1 119 1 180 1 81 2 31 1 5 1 28 1 3 1 14 6 1 4 1 5 5 3 4 2 5 9 2 8 2 11 4 46 5 14 5 34 3 32 4 35 3 34 5 16 4 52 9 2 5 28 5 23 4 23 4 29 4 32 3 34 5 19 4 47 14 28 4 20 4 22 127 1 91 1</runs>
        <runs>0 914 2 42 1 19 1 100 1 48 1 4 1 4 2 3 10 2 7 4 32 3 34 5 19 4 47 14 28 4 20 4 22 73 31 5 19 3 47 9 2 4 27 5 7 10 3 87 1</runs>
        <runs>0 1197 1 36 1 116 1 4 2 12 6 6 1 3 5 9 2 73 31 5 19 3 47 9 2 4 27 5 108</runs>
        <runs>0 1351 1 123 31 5 19 3 47 9 2 4 27 5 108</runs>
        <runs>0 1621 1 24 3 39 1 13 33</runs>
      </run-table>
    </glyph>
    <glyph left="124" top="2367" id="313">
      <run-table orientation="HORIZONTAL" width="1743" height="10">
        <runs>0 27 1 339 1</runs>
        <runs>0 2 4 2 14 5 6 4 1 19 2 17 7 7 2 14 1 2 24 3 4 2 7 2 2 3 3 6 7 3 2 3 1 3 2 3 9 5 7 5 23 3 43 5 29 3 11 1 35 5 15 4 8 4 1 3 10 1 1 4 2 18 7 75 2 85 1 88 1</runs>
        <runs>0 1 21 5 11 11 91 2 56 5 35 3 43 5 29 3 47 5 15 4 136 5 64 2 5 4 6 5 44 10 1 2 1 7 4 8 2 4 2 1 2 17 1 12 3 44 1 4 1 52 1 33 1 76 1 5 1 19 1 153 1</runs>
        <runs>22 5 11 11 91 2 56 5 35 3 43 5 29 3 47 5 15 4 136 5 81 5 79 4 83 4 54 4 30 5 33 5 34 5 16 4 96 5 50 3 11 4 2 4 9 10 3 7 9 5 1 3 1 2 1 1 2 27 1 4 1 18 1 92 1 4 1</runs>
        <runs>0 20 1 6 11 21 1 11 7 10 4 2 2 3 3 21 4 17 2 20 1 95 3 75 1 2 2 47 3 18 6 3 7 2 1 1 74 4 17 5 81 5 79 4 83 4 54 4 30 5 33 5 34 5 16 4 96 5 50 3 30 4 31 3 35 4 20 4 84 2 3 4 5 2 9 1 5 5 3</runs>
        <runs>0 37 1 752 3 1 7 2 3 6 1 4 5 1 11 2 2 3 2 4 30 5 33 5 34 5 16 4 81 1 14 5 50 3 30 4 31 3 35 4 20 4 89 4 119 5 4 15 1 4 3 114 1</runs>
        <runs>0 882 4 9 2 77 1 4 1 37 2 87 4 4 3 7 2 1 3 3 30 4 31 3 35 4 20 4 89 4 151 4 47 1 30 3 13 16 1 4 1 107 1</runs>
        <runs>0 1106 3 20 1 32 1 38 1 57 1 152 1 16 3 3 7 1 65 4 111 4 109</runs>
        <runs>0 1469 5 38 4 5 10 3 89 4 109</runs>
        <runs>0 1470 2 161 3 17 3 4 4 6 2 3 8 13 40</runs>
      </run-table>
    </glyph>
  </glyph-index>
</sheet>"""  # Replace with your XML data
page_data = extract_staff_data(xml_data)
json_data = json.dumps(page_data, separators=(',', ':'))

# Formatting
json_data = json_data.replace('\n', '')
json_data = json_data.replace('{"cs"', '\n{"cs"')
json_data = json_data.replace(',[', ',\n[')
json_data = json_data.replace(',"bxs":[', ',\n"bxs":[\n')
json_data = json_data.replace(',{"cxs":', ',\n{"cxs":')

# Add initial 1000 value
json_data = "[1000," + json_data[1:]

# Start each bxs subgroup with x1 from cs
json_data = re.sub(r',"bxs":\[\[([\d.]+),', r',"bxs":[[\1,', json_data)

# Copy to clipboard
pyperclip.copy(json_data)

print(json_data)

