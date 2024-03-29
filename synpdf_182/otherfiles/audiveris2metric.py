import xml.etree.ElementTree as ET
import json
import re

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
            staff_xs = []
            for staff in system.iter('staff'):
                staff_info = {}
                cs = []
                for line in staff.iter('line'):
                    points = list(line.iter('point'))
                    cs.append(normalize(float(points[0].attrib['y']), max_val))
                staff_info['cs'] = cs
                staff_info['xs'] = {"x1": normalize(float(staff.attrib['left']), max_val), "x2": normalize(float(staff.attrib['right']), max_val)}
                page_info['cxs'].append(staff_info)
                staff_xs.append(normalize(float(staff.attrib['left']), max_val))
            bxs.extend(staff_xs)
            for barline in system.iter('barline'):
                bxs.append(normalize(float(barline.find('bounds').attrib['x']), max_val))
            page_info['bxs'].append(bxs)
        page_data.append(page_info)

    return page_data



xml_data = "<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0.2 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0.2">
  <identification>
    <rights>Creative Commons Attribution-ShareAlike 4.0 License</rights>
    <encoding>
      <software>Audiveris 5.3.1</software>
      <supports type="yes" element="print" attribute="new-system" value="yes"></supports>
      <supports type="yes" element="print" attribute="new-page" value="yes"></supports>
      <software>ProxyMusic 4.0.2</software>
      <encoding-date>2023-12-08</encoding-date>
    </encoding>
    <source>C:\xampp\htdocs\synpdf_182\smallerpdfs\Newfolder\57-48.pdf</source>
    <miscellaneous>
      <miscellaneous-field name="source-file">C:\xampp\htdocs\synpdf_182\smallerpdfs\Newfolder\57-48.pdf</miscellaneous-field>
      <miscellaneous-field name="source-sheet-15">1 2</miscellaneous-field>
    </miscellaneous>
  </identification>
  <defaults>
    <scaling>
      <millimeters>6.4347</millimeters>
      <tenths>40</tenths>
    </scaling>
    <page-layout>
      <page-height>1846</page-height>
      <page-width>1305</page-width>
      <page-margins type="both">
        <left-margin>80</left-margin>
        <right-margin>80</right-margin>
        <top-margin>80</top-margin>
        <bottom-margin>80</bottom-margin>
      </page-margins>
    </page-layout>
    <lyric-font font-family="Sans Serif" font-size="10"></lyric-font>
  </defaults>
  <credit page="1">
    <credit-words font-family="serif" font-size="10" default-x="1226" default-y="1799">I7</credit-words>
  </credit>
  <credit page="1">
    <credit-words font-family="serif" font-size="13" default-x="80" default-y="802">7‘.</credit-words>
  </credit>
  <credit page="1">
    <credit-words font-family="sans-serif" font-size="6" default-x="94" default-y="39">Copyright © 2009-2022 Nicolas Sceaux</credit-words>
  </credit>
  <credit page="1">
    <credit-words font-family="serif" font-size="6" default-x="346" default-y="39">Creative Commons Attribution-ShareAlike 4.0 License</credit-words>
  </credit>
  <part-list>
    <score-part id="P1">
      <part-name>Voice</part-name>
      <part-abbreviation>Voice</part-abbreviation>
      <score-instrument id="P1-I1">
        <instrument-name>Voice Oohs</instrument-name>
      </score-instrument>
      <midi-instrument id="P1-I1">
        <midi-channel>1</midi-channel>
        <midi-program>54</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>
    <score-part id="P2">
      <part-name>Voice</part-name>
      <part-abbreviation>Voice</part-abbreviation>
      <score-instrument id="P2-I1">
        <instrument-name>Voice Oohs</instrument-name>
      </score-instrument>
      <midi-instrument id="P2-I1">
        <midi-channel>2</midi-channel>
        <midi-program>54</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>
    <score-part id="P3">
      <part-name>Voice</part-name>
      <part-abbreviation>Voice</part-abbreviation>
      <score-instrument id="P3-I1">
        <instrument-name>Voice Oohs</instrument-name>
      </score-instrument>
      <midi-instrument id="P3-I1">
        <midi-channel>3</midi-channel>
        <midi-program>54</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>
    <score-part id="P4">
      <part-name>Voice</part-name>
      <part-abbreviation>Voice</part-abbreviation>
      <score-instrument id="P4-I1">
        <instrument-name>Voice Oohs</instrument-name>
      </score-instrument>
      <midi-instrument id="P4-I1">
        <midi-channel>4</midi-channel>
        <midi-program>54</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>
    <score-part id="P5">
      <part-name>Piano</part-name>
      <part-abbreviation>Piano</part-abbreviation>
      <score-instrument id="P5-I1">
        <instrument-name>Acoustic Grand Piano</instrument-name>
      </score-instrument>
      <midi-instrument id="P5-I1">
        <midi-channel>5</midi-channel>
        <midi-program>1</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>
  </part-list>
  <!--= = = = = = = = = = = = = = = = = = = = = = = = = = = = =-->
  <part id="P1">
    <!--=======================================================-->
    <measure number="1" width="225">
      <print>
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <top-system-distance>21</top-system-distance>
        </system-layout>
        <measure-numbering>system</measure-numbering>
      </print>
      <attributes>
        <divisions>6</divisions>
        <key>
          <fifths>3</fifths>
        </key>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <direction placement="above">
        <direction-type>
          <words></words>
        </direction-type>
        <sound tempo="120"></sound>
      </direction>
      <note default-x="99">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-71" placement="below">
          <syllabic>single</syllabic>
          <text>it.</text>
        </lyric>
      </note>
      <note default-x="189">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="2" width="133">
      <note default-x="59">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="3" width="144">
      <note default-x="65">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="4" width="132">
      <direction placement="above">
        <direction-type>
          <words font-family="serif" font-style="italic" font-size="11" font-weight="bold" default-y="54" relative-x="-24">PART I</words>
        </direction-type>
      </direction>
      <note default-x="58">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="5" width="121">
      <note default-x="53">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="6" width="117">
      <note default-x="52">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="7" width="124">
      <note default-x="13">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="46">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-71" placement="below">
          <syllabic>single</syllabic>
          <text>And</text>
        </lyric>
      </note>
      <note default-x="88">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-71" placement="below">
          <syllabic>single</syllabic>
          <text>all</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="8" width="152">
      <note default-x="21">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <accidental>sharp</accidental>
        <stem default-y="-42">down</stem>
        <beam number="1">begin</beam>
        <notations>
          <slur type="start" number="1" default-x="7" default-y="2" placement="above" bezier-x="20" bezier-y="7"></slur>
        </notations>
        <lyric number="1" default-y="-71" placement="below">
          <syllabic>single</syllabic>
          <text>ﬂesh</text>
        </lyric>
      </note>
      <note default-x="46">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-43">down</stem>
        <beam number="1">end</beam>
      </note>
      <note default-x="78">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <notations>
          <slur type="stop" number="1" default-x="7" default-y="-7" bezier-x="-16" bezier-y="13"></slur>
        </notations>
        <lyric number="1" default-y="-71" placement="below">
          <syllabic>single</syllabic>
          <text>shall</text>
        </lyric>
      </note>
      <note default-x="116">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="9" width="239">
      <print new-system="yes">
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <system-distance>331</system-distance>
        </system-layout>
      </print>
      <attributes>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="104">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <accidental>sharp</accidental>
        <stem default-y="-42">down</stem>
        <beam number="1">begin</beam>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>see</text>
        </lyric>
      </note>
      <note default-x="129">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-43">down</stem>
        <beam number="1">end</beam>
      </note>
      <note default-x="163">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <notations>
          <articulations>
            <staccato default-y="-60" placement="below"></staccato>
          </articulations>
        </notations>
      </note>
      <note default-x="203">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>to</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="10" width="101">
      <note default-x="13">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>ge</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="11" width="133">
      <note default-x="22">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>ther.</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="12" width="138">
      <note default-x="62">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="13" width="123">
      <note default-x="54">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="14" width="142">
      <note default-x="21">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="57">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>And</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="15" width="142">
      <note default-x="22">
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <accidental>sharp</accidental>
        <stem default-y="9">up</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>begin</syllabic>
          <text>glo</text>
        </lyric>
      </note>
      <note default-x="67">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="5">up</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>end</syllabic>
          <text>ry,</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="16" width="132">
      <note default-x="13">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>glory</text>
        </lyric>
      </note>
      <note default-x="57">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>of</text>
        </lyric>
      </note>
      <note default-x="94">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-49">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
  </part>
  <!--= = = = = = = = = = = = = = = = = = = = = = = = = = = = =-->
  <part id="P2">
    <!--=======================================================-->
    <measure number="1" width="225">
      <print>
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <top-system-distance>21</top-system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>70</staff-distance>
        </staff-layout>
        <measure-numbering>none</measure-numbering>
      </print>
      <attributes>
        <divisions>6</divisions>
        <key>
          <fifths>3</fifths>
        </key>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="100">
        <pitch>
          <step>A</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="9">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>ther,</text>
        </lyric>
      </note>
      <note default-x="152">
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-5">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>and</text>
        </lyric>
      </note>
      <note default-x="191">
        <pitch>
          <step>A</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="9">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>all</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="2" width="133">
      <note default-x="11">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="4">up</stem>
        <beam number="1">begin</beam>
        <notations>
          <slur type="start" number="1" default-x="5" default-y="-41" placement="below" bezier-x="13" bezier-y="-12"></slur>
        </notations>
      </note>
      <note default-x="36">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="1">up</stem>
        <beam number="1">end</beam>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>ﬂesh,</text>
        </lyric>
      </note>
      <note default-x="60">
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-5">up</stem>
        <notations>
          <slur type="stop" number="1" default-x="5" default-y="-50" bezier-x="-17" bezier-y="-7"></slur>
        </notations>
      </note>
      <note default-x="97">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="3" width="144">
      <note default-x="20">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="71">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>and</text>
        </lyric>
      </note>
      <note default-x="109">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>all</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="4" width="132">
      <note default-x="11">
        <pitch>
          <step>A</step>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="4">up</stem>
        <beam number="1">begin</beam>
        <notations>
          <slur type="start" number="1" default-x="5" default-y="-35" placement="below" bezier-x="13" bezier-y="-13"></slur>
        </notations>
      </note>
      <note default-x="36">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="3">up</stem>
        <beam number="1">end</beam>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>ﬂesh</text>
        </lyric>
      </note>
      <note default-x="60">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <notations>
          <slur type="stop" number="1" default-x="5" default-y="-45" bezier-x="-17" bezier-y="-6"></slur>
        </notations>
      </note>
      <note default-x="96">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>shall</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="5" width="121">
      <note default-x="11">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="5">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>see</text>
        </lyric>
      </note>
      <note default-x="47">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="5">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>it</text>
        </lyric>
      </note>
      <note default-x="83">
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="9">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>to</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="6" width="117">
      <note default-x="22">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>begin</syllabic>
          <text>ge</text>
        </lyric>
      </note>
      <note default-x="72">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>end</syllabic>
          <text>ther,</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="7" width="124">
      <note default-x="13">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="47">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-9">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>and</text>
        </lyric>
      </note>
      <note default-x="89">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="5">up</stem>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>all</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="8" width="152">
      <note default-x="22">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-6">up</stem>
        <beam number="1">begin</beam>
        <notations>
          <slur type="start" number="1" default-x="5" default-y="-50" placement="below" bezier-x="17" bezier-y="-12"></slur>
        </notations>
      </note>
      <direction placement="below">
        <direction-type>
          <pedal type="start" line="no" default-x="22" default-y="-85" halign="left"></pedal>
        </direction-type>
        <sound damper-pedal="yes"></sound>
      </direction>
      <note default-x="47">
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-7">up</stem>
        <beam number="1">end</beam>
      </note>
      <note default-x="79">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-9">up</stem>
        <notations>
          <slur type="stop" number="1" default-x="5" default-y="-55" bezier-x="-19" bezier-y="-9"></slur>
        </notations>
        <lyric number="1" default-y="-85" placement="below">
          <syllabic>single</syllabic>
          <text>shall</text>
        </lyric>
      </note>
      <note default-x="117">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="5">up</stem>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="9" width="239">
      <print new-system="yes">
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <system-distance>331</system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>75</staff-distance>
        </staff-layout>
      </print>
      <attributes>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="105">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-5">up</stem>
        <beam number="1">begin</beam>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>see</text>
        </lyric>
      </note>
      <note default-x="129">
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-7">up</stem>
        <beam number="1">end</beam>
      </note>
      <note default-x="163">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-9">up</stem>
        <notations>
          <articulations>
            <staccato default-y="-67" placement="below"></staccato>
          </articulations>
        </notations>
      </note>
      <note default-x="203">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>to</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="10" width="101">
      <note default-x="13">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-52">down</stem>
        <notations>
          <slur type="start" number="1" default-x="7" default-y="-7" placement="above" bezier-x="14" bezier-y="6"></slur>
        </notations>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>ge</text>
        </lyric>
      </note>
      <note default-x="64">
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="10">up</stem>
        <notations>
          <slur type="stop" number="1" default-x="0" default-y="-9" bezier-x="-14" bezier-y="7"></slur>
        </notations>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="11" width="133">
      <note default-x="22">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>ther.</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="12" width="138">
      <note default-x="62">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="13" width="123">
      <note default-x="54">
        <rest measure="yes">
          <display-step>C</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="14" width="142">
      <note default-x="21">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="57">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>And</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="15" width="142">
      <note default-x="22">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>begin</syllabic>
          <text>glo</text>
        </lyric>
      </note>
      <note default-x="67">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="1">up</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>end</syllabic>
          <text>ry,</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-19">up</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="16" width="132">
      <note default-x="14">
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>quarter</type>
        <time-modification>
          <actual-notes>3</actual-notes>
          <normal-notes>2</normal-notes>
        </time-modification>
        <stem default-y="-5">up</stem>
        <notations>
          <tuplet type="start" number="1" placement="below"></tuplet>
        </notations>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>glory</text>
        </lyric>
      </note>
      <note default-x="58">
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>quarter</type>
        <time-modification>
          <actual-notes>3</actual-notes>
          <normal-notes>2</normal-notes>
        </time-modification>
        <stem default-y="-5">up</stem>
        <lyric number="1" default-y="-84" placement="below">
          <syllabic>single</syllabic>
          <text>of</text>
        </lyric>
      </note>
      <note default-x="95">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>quarter</type>
        <time-modification>
          <actual-notes>3</actual-notes>
          <normal-notes>2</normal-notes>
        </time-modification>
        <stem default-y="1">up</stem>
        <notations>
          <tuplet type="stop" number="1"></tuplet>
        </notations>
      </note>
    </measure>
  </part>
  <!--= = = = = = = = = = = = = = = = = = = = = = = = = = = = =-->
  <part id="P3">
    <!--=======================================================-->
    <measure number="1" width="225">
      <print>
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <top-system-distance>21</top-system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>86</staff-distance>
        </staff-layout>
        <measure-numbering>none</measure-numbering>
      </print>
      <attributes>
        <divisions>6</divisions>
        <key>
          <fifths>3</fifths>
        </key>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="99">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-48">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>ther,</text>
        </lyric>
      </note>
      <note default-x="189">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="2" width="133">
      <note default-x="9">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="60">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>and</text>
        </lyric>
      </note>
      <note default-x="98">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>all</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="3" width="144">
      <note default-x="21">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <accidental>sharp</accidental>
        <stem default-y="-41">down</stem>
        <beam number="1">begin</beam>
        <notations>
          <slur type="start" number="1" default-x="7" default-y="3" placement="above" bezier-x="17" bezier-y="6"></slur>
        </notations>
      </note>
      <note default-x="46">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-43">down</stem>
        <beam number="1">end</beam>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>ﬂesh</text>
        </lyric>
      </note>
      <note default-x="70">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <notations>
          <slur type="stop" number="1" default-x="7" default-y="-7" bezier-x="-13" bezier-y="13"></slur>
        </notations>
      </note>
      <note default-x="109">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>shall</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="4" width="132">
      <note default-x="11">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-48">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>see</text>
        </lyric>
      </note>
      <note default-x="59">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-48">down</stem>
        <notations>
          <articulations>
            <staccato default-y="-59" placement="below"></staccato>
          </articulations>
        </notations>
      </note>
      <note default-x="95">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>begin</syllabic>
          <text>to</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="5" width="121">
      <note default-x="11">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>middle</syllabic>
          <text>ge</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="6" width="117">
      <note default-x="22">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>end</syllabic>
          <text>ther,</text>
        </lyric>
      </note>
      <note default-x="71">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="7" width="124">
      <note default-x="13">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>mouth</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="8" width="152">
      <note default-x="21">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>of</text>
        </lyric>
      </note>
      <note default-x="117">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="9" width="239">
      <print new-system="yes">
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <system-distance>331</system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>82</staff-distance>
        </staff-layout>
      </print>
      <attributes>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="104">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>Lord</text>
        </lyric>
      </note>
      <note default-x="203">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-34">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>hath</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="10" width="101">
      <note default-x="13">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>begin</syllabic>
          <text>spo</text>
        </lyric>
      </note>
      <note default-x="63">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>end</syllabic>
          <text>ken</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="11" width="133">
      <note default-x="22">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-34">down</stem>
        <notations>
          <articulations>
            <staccato default-y="-57" placement="below"></staccato>
          </articulations>
        </notations>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="12" width="138">
      <note default-x="62">
        <rest measure="yes">
          <display-step>D</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="13" width="123">
      <note default-x="54">
        <rest measure="yes">
          <display-step>D</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="14" width="142">
      <note default-x="21">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="57">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>And</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="15" width="142">
      <note default-x="22">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <stem default-y="-49">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>begin</syllabic>
          <text>glo</text>
        </lyric>
      </note>
      <note default-x="66">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-49">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>end</syllabic>
          <text>ry,</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="16" width="132">
      <note default-x="13">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>glory</text>
        </lyric>
      </note>
      <note default-x="57">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>of</text>
        </lyric>
      </note>
      <note default-x="94">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-49">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
  </part>
  <!--= = = = = = = = = = = = = = = = = = = = = = = = = = = = =-->
  <part id="P4">
    <!--=======================================================-->
    <measure number="1" width="225">
      <print>
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <top-system-distance>21</top-system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>78</staff-distance>
        </staff-layout>
        <measure-numbering>none</measure-numbering>
      </print>
      <attributes>
        <divisions>6</divisions>
        <key>
          <fifths>3</fifths>
        </key>
        <clef>
          <sign>F</sign>
          <line>4</line>
        </clef>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="99">
        <pitch>
          <step>A</step>
          <octave>3</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-34">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>ther,</text>
        </lyric>
      </note>
      <note default-x="189">
        <rest>
          <display-step>D</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="2" width="133">
      <note default-x="59">
        <rest measure="yes">
          <display-step>F</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="3" width="144">
      <note default-x="65">
        <rest measure="yes">
          <display-step>F</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="4" width="132">
      <note default-x="58">
        <rest measure="yes">
          <display-step>F</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="5" width="121">
      <note default-x="53">
        <rest measure="yes">
          <display-step>F</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="6" width="117">
      <note default-x="22">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>for</text>
        </lyric>
      </note>
      <note default-x="71">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="7" width="124">
      <note default-x="13">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>mouth</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="8" width="152">
      <note default-x="21">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>of</text>
        </lyric>
      </note>
      <note default-x="116">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-74" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="9" width="239">
      <print new-system="yes">
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <system-distance>331</system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>87</staff-distance>
        </staff-layout>
      </print>
      <attributes>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="104">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>Lord</text>
        </lyric>
      </note>
      <note default-x="203">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>hath</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="10" width="101">
      <note default-x="13">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-24">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>begin</syllabic>
          <text>spo</text>
        </lyric>
      </note>
      <note default-x="63">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-24">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>end</syllabic>
          <text>ken</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="11" width="133">
      <note default-x="22">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>18</duration>
        <voice>1</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-29">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>it.</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="12" width="138">
      <note default-x="62">
        <rest measure="yes">
          <display-step>F</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="13" width="123">
      <note default-x="54">
        <rest measure="yes">
          <display-step>F</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="14" width="142">
      <note default-x="21">
        <rest>
          <display-step>D</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <note default-x="57">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>And</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>B</step>
          <octave>2</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="5">up</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="15" width="142">
      <note default-x="22">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <stem default-y="-44">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>begin</syllabic>
          <text>glo</text>
        </lyric>
      </note>
      <note default-x="66">
        <pitch>
          <step>E</step>
          <octave>3</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-48">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>end</syllabic>
          <text>ry,</text>
        </lyric>
      </note>
      <note default-x="104">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-52">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="16" width="132">
      <note default-x="13">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>glory</text>
        </lyric>
      </note>
      <note default-x="57">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>of</text>
        </lyric>
      </note>
      <note default-x="94">
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-34">down</stem>
        <lyric number="1" default-y="-77" placement="below">
          <syllabic>single</syllabic>
          <text>the</text>
        </lyric>
      </note>
    </measure>
  </part>
  <!--= = = = = = = = = = = = = = = = = = = = = = = = = = = = =-->
  <part id="P5">
    <!--=======================================================-->
    <measure number="1" width="225">
      <print>
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <top-system-distance>21</top-system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>102</staff-distance>
        </staff-layout>
        <staff-layout number="2">
          <staff-distance>54</staff-distance>
        </staff-layout>
        <measure-numbering>none</measure-numbering>
      </print>
      <attributes>
        <divisions>6</divisions>
        <key>
          <fifths>3</fifths>
        </key>
        <staves>2</staves>
        <clef number="1">
          <sign>G</sign>
          <line>2</line>
        </clef>
        <clef number="2">
          <sign>F</sign>
          <line>4</line>
        </clef>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="99">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="99">
        <chord/>
        <pitch>
          <step>A</step>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="99">
        <chord/>
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>6</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="189">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="100">
        <pitch>
          <step>A</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-34">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="152">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="10">up</stem>
        <staff>2</staff>
      </note>
      <note default-x="191">
        <pitch>
          <step>A</step>
          <octave>2</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="1">up</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="2" width="133">
      <note default-x="59">
        <rest measure="yes">
          <display-step>D</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="11">
        <pitch>
          <step>E</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-48">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="59">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="98">
        <pitch>
          <step>E</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-48">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="3" width="144">
      <note default-x="65">
        <rest measure="yes">
          <display-step>D</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="21">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="70">
        <pitch>
          <step>A</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-34">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="109">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="4" width="132">
      <note default-x="58">
        <rest measure="yes">
          <display-step>D</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="11">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="59">
        <pitch>
          <step>A</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-34">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="95">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="5" width="121">
      <note default-x="53">
        <rest measure="yes">
          <display-step>D</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="11">
        <pitch>
          <step>E</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-48">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="47">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-52">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="83">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="10">up</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="6" width="117">
      <note default-x="52">
        <rest measure="yes">
          <display-step>D</display-step>
          <display-octave>5</display-octave>
        </rest>
        <duration>18</duration>
        <voice>1</voice>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="23">
        <pitch>
          <step>B</step>
          <octave>2</octave>
        </pitch>
        <duration>12</duration>
        <voice>5</voice>
        <type>half</type>
        <stem default-y="5">up</stem>
        <staff>2</staff>
      </note>
      <note default-x="72">
        <pitch>
          <step>B</step>
          <octave>2</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="5">up</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="7" width="124">
      <note default-x="13">
        <rest>
          <display-step>B</display-step>
          <display-octave>4</display-octave>
        </rest>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <staff>1</staff>
      </note>
      <note default-x="47">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="47">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="47">
        <chord/>
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="88">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="88">
        <chord/>
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="13">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>18</duration>
        <voice>5</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="8" width="152">
      <note default-x="22">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <accidental>sharp</accidental>
        <stem default-y="27">up</stem>
        <staff>1</staff>
        <beam number="1">begin</beam>
      </note>
      <note default-x="22">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="27">up</stem>
        <staff>1</staff>
        <beam number="1">begin</beam>
      </note>
      <note default-x="46">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="24">up</stem>
        <staff>1</staff>
        <beam number="1">end</beam>
      </note>
      <note default-x="46">
        <chord/>
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="24">up</stem>
        <staff>1</staff>
        <beam number="1">end</beam>
      </note>
      <note default-x="79">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="79">
        <chord/>
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="117">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="29">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="117">
        <chord/>
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="29">up</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="21">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>2</voice>
        <type>half</type>
        <stem default-y="-62">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="116">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>2</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="21">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>12</duration>
        <voice>5</voice>
        <type>half</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="116">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="9" width="239">
      <print new-system="yes">
        <system-layout>
          <system-margins>
            <left-margin>14</left-margin>
            <right-margin>-17</right-margin>
          </system-margins>
          <system-distance>331</system-distance>
        </system-layout>
        <staff-layout number="1">
          <staff-distance>102</staff-distance>
        </staff-layout>
        <staff-layout number="2">
          <staff-distance>54</staff-distance>
        </staff-layout>
      </print>
      <attributes>
        <staff-details print-object="yes"></staff-details>
      </attributes>
      <note default-x="105">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <accidental>sharp</accidental>
        <stem default-y="27">up</stem>
        <staff>1</staff>
        <beam number="1">begin</beam>
      </note>
      <note default-x="105">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="27">up</stem>
        <staff>1</staff>
        <beam number="1">begin</beam>
      </note>
      <note default-x="129">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="24">up</stem>
        <staff>1</staff>
        <beam number="1">end</beam>
      </note>
      <note default-x="129">
        <chord/>
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="24">up</stem>
        <staff>1</staff>
        <beam number="1">end</beam>
      </note>
      <note default-x="163">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="163">
        <chord/>
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>12</duration>
      </backup>
      <note default-x="104">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>2</voice>
        <type>half</type>
        <stem default-y="-62">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="203">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>2</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="203">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>2</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="203">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>2</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="104">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>12</duration>
        <voice>5</voice>
        <type>half</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="203">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="10" width="101">
      <note default-x="13">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="13">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>5</octave>
        </pitch>
        <duration>12</duration>
        <voice>1</voice>
        <type>half</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="63">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="63">
        <chord/>
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="13">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>12</duration>
        <voice>5</voice>
        <type>half</type>
        <stem default-y="-24">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="63">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-24">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="11" width="133">
      <note default-x="22">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="22">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="22">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="55">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="55">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="55">
        <chord/>
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="92">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="13">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="92">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="13">up</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="22">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>18</duration>
        <voice>5</voice>
        <type>half</type>
        <dot/>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="12" width="138">
      <note default-x="22">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="22">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="74">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-48">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="74">
        <chord/>
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-48">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="100">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="100">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <note default-x="100">
        <chord/>
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="20">up</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="21">
        <rest>
          <display-step>D</display-step>
          <display-octave>3</display-octave>
        </rest>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <staff>2</staff>
      </note>
      <note default-x="55">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="99">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-19">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="13" width="123">
      <note default-x="11">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="11">
        <chord/>
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="49">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="49">
        <chord/>
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="86">
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="86">
        <chord/>
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-39">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="11">
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-19">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="49">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-19">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="86">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-24">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="14" width="142">
      <note default-x="22">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="22">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="57">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="57">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="104">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="104">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="104">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-44">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="22">
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-29">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="57">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-52">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="105">
        <pitch>
          <step>B</step>
          <octave>2</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="5">up</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="15" width="142">
      <note default-x="22">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <stem default-y="-48">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="22">
        <chord/>
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>9</duration>
        <voice>1</voice>
        <type>quarter</type>
        <dot/>
        <accidental>sharp</accidental>
        <stem default-y="-48">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="66">
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-48">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="66">
        <chord/>
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>3</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem default-y="-48">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="104">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="104">
        <chord/>
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="104">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="22">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>9</duration>
        <voice>5</voice>
        <type>quarter</type>
        <dot/>
        <stem default-y="-44">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="66">
        <pitch>
          <step>E</step>
          <octave>3</octave>
        </pitch>
        <duration>3</duration>
        <voice>5</voice>
        <type>eighth</type>
        <stem default-y="-48">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="104">
        <pitch>
          <step>D</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-52">down</stem>
        <staff>2</staff>
      </note>
    </measure>
    <!--=======================================================-->
    <measure number="16" width="132">
      <note default-x="13">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="13">
        <chord/>
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="13">
        <chord/>
        <pitch>
          <step>B</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="57">
        <pitch>
          <step>B</step>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="57">
        <chord/>
        <pitch>
          <step>E</step>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-52">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="94">
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>4</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-62">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="94">
        <chord/>
        <pitch>
          <step>C</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-62">down</stem>
        <staff>1</staff>
      </note>
      <note default-x="94">
        <chord/>
        <pitch>
          <step>F</step>
          <alter>1</alter>
          <octave>5</octave>
        </pitch>
        <duration>6</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem default-y="-62">down</stem>
        <staff>1</staff>
      </note>
      <backup>
        <duration>18</duration>
      </backup>
      <note default-x="13">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="57">
        <pitch>
          <step>G</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <stem default-y="-39">down</stem>
        <staff>2</staff>
      </note>
      <note default-x="94">
        <pitch>
          <step>A</step>
          <alter>1</alter>
          <octave>3</octave>
        </pitch>
        <duration>6</duration>
        <voice>5</voice>
        <type>quarter</type>
        <accidental>sharp</accidental>
        <stem default-y="-34">down</stem>
        <staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>"  # Replace with your XML data
page_data = extract_staff_data(xml_data)
json_data = json.dumps(page_data, separators=(',', ':'))

# Formatting
json_data = json_data.replace('\n', '')
json_data = json_data.replace('{"cs"', '\n{"cs"')
json_data = json_data.replace(',[', ',\n[')
json_data = json_data.replace(',"bxs":[', ',\n"bxs":[\n')
json_data = json_data.replace(',{"cxs":', ',\n{"cxs":')

print(json_data)
