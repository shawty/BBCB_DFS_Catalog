var binaryDiskBlob = null;
var diskTitle = null;
var catalog = null;
var diskWrites = 0;
var catalogEntryCount = 0;
var sectorCount = 0;
var bootOptions = 0;
var gFileId = String("0");

function hideElement(element)
{
  $('#' + element).hide();
}

function showElement(element)
{
  $('#' + element).show();
}

function loadDiskTable()
{
  hideElement('diskTable');
  showElement('disksLoading');
  $('#diskTable tbody').empty();
  networkGet("disks.json")
    .then(function (data)
    {

      data.forEach(function (dataItem)
      {

        var newTableLine = "<tr><td>" +
          dataItem.name +
          "</td><td>" +
          dataItem.diskTitle +
          "</td><td>" +
          dataItem.diskType +
          "</td><td>" +
          '<button type="button" class="btn btn-primary btn-xs" onclick="openDisk(\'' + dataItem.name + '\')">Open</button>&nbsp;' +
          '<button type="button" class="btn btn-success btn-xs" onclick="downloadDisk(\'' + dataItem.name + '\')">Download</button>' +
          "</td></tr>";

        $('#diskTable tbody').append(newTableLine);

      });
      showElement('diskTable');
      hideElement('disksLoading');

    })
    .fail(function (xhr)
    {
      alert("ERROR: Failed to load 'disks.json' with error code " + xhr.status);
    });
}

function networkGet(url)
{
  return $.ajax({ method: "GET", url: url, cache: false });
};

function openDisk(diskName)
{
  $('#diskContentName').html(diskName.replace(/\\/g,'/').replace( /.*\//, '' ));
  hideElement('availableDisks');
  showElement('diskContents');

  var diskPath = diskName;

  networkGetBinaryBlob(diskPath)
    .then(function ()
    {
      decodeDiskCatalog();
      displayDiskCatalog();
    });
}

function downloadDisk(diskName)
{
  var diskPath = diskName;

  networkGetBinaryBlob(diskPath)
    .then(function () {
      downloadBinaryData(diskName, binaryDiskBlob);
    });
}

function decodeDiskCatalog()
{
  var catalogOffset = 0; // Sector one

  diskTitle = getStringFromBinary(catalogOffset, 8);
  catalog = new Array();

  catalogOffset += 8;
  for(var sectOneCount = 0; sectOneCount < 31; sectOneCount++)
  {
    var catalogEntry = {
      fileName: getStringFromBinary(catalogOffset, 7).trim().toUpperCase(),
      fileDirectory: getSevenBitCharFromBinary(catalogOffset + 7),
      fileLocked: getTopBitSetFromBinary(catalogOffset + 7),
      fileLoad: 0,
      fileExec: 0,
      fileLength: 0,
      startSector: 0
    };
    catalog.push(catalogEntry);
    catalogOffset += 8;
  }

  catalogOffset = 256; // Sector two

  diskTitle = diskTitle + getStringFromBinary(catalogOffset, 4);
  catalogOffset += 4;

  diskWrites = getEightBitValueFromBinary(catalogOffset);
  catalogOffset++;

  catalogEntryCount = getEightBitValueFromBinary(catalogOffset) / 8;
  catalogOffset++;

  sectorCount = ((getEightBitValueFromBinary(catalogOffset) & 0x03) << 8) + getEightBitValueFromBinary(catalogOffset + 1);
  bootOptions = ((getEightBitValueFromBinary(catalogOffset) & 0xF0) >> 4);
  catalogOffset += 2;

  for(var sectTwoCount = 0; sectTwoCount < 31; sectTwoCount++)
  {
    // Full Tube Compatible Addressing
    //catalog[sectTwoCount].fileLoad = (((getEightBitValueFromBinary(catalogOffset + 0x06) & 0x0C) >> 2) << 16) + getSixteenBitValueFromBinary(catalogOffset);
    //catalog[sectTwoCount].fileExec = (((getEightBitValueFromBinary(catalogOffset + 0x06) & 0xC0) >> 6) << 16) + getSixteenBitValueFromBinary(catalogOffset + 0x02);
    //catalog[sectTwoCount].fileLength = (((getEightBitValueFromBinary(catalogOffset + 0x06) & 0x30) >> 4) << 16) + getSixteenBitValueFromBinary(catalogOffset + 0x04);
    //catalog[sectTwoCount].startSector = ((getEightBitValueFromBinary(catalogOffset + 0x06) & 0x03) << 8) + getEightBitValueFromBinary(catalogOffset + 0x07);

    // Normal Addressing (That everyones used too)
    catalog[sectTwoCount].fileLoad = getSixteenBitValueFromBinary(catalogOffset);
    catalog[sectTwoCount].fileExec = getSixteenBitValueFromBinary(catalogOffset + 0x02);
    catalog[sectTwoCount].fileLength = (((getEightBitValueFromBinary(catalogOffset + 0x06) & 0x30) >> 4) << 16) + getSixteenBitValueFromBinary(catalogOffset + 0x04);
    catalog[sectTwoCount].startSector = ((getEightBitValueFromBinary(catalogOffset + 0x06) & 0x03) << 8) + getEightBitValueFromBinary(catalogOffset + 0x07);

    catalogOffset += 8;
  }
}

function displayDiskCatalog()
{
  $('#diskTitle').html(diskTitle);
  $('#diskWrites').html(diskWrites);

  var sizeInKb = (sectorCount * 256) / 1024;
  var tracks = (sectorCount > 400) ? 80 : 40;
  $('#diskSize').html(sizeInKb + "K (" + tracks + " track)");

  $('#bootOption').html(bootOptions);

  $('#fileTable tbody').empty();
  for (var catCount = 0; catCount < catalogEntryCount; catCount++)
  {
    var fileItem = catalog[catCount];

    var newTableLine = "<tr><td>" +
      fileItem.fileDirectory +
      "</td><td>" +
      fileItem.fileName +
      "</td><td>" +
      decimalToHex(fileItem.fileLoad, 4) +
      "</td><td>" +
      decimalToHex(fileItem.fileExec, 4) +
      "</td><td>" +
      decimalToHex(fileItem.fileLength, 4) +
      "</td><td>" +
      ((fileItem.fileLocked === true) ? "L" : "") +
      "</td><td>" +
      '<button type="button" class="btn btn-success btn-xs" onclick="downloadSingleFile(\'' + catCount + '\')">Download</button>' +
      "</td><td>" +
      '<button id="bdis'+catCount+'" type="button" class="btn btn-default btn-xs" onclick="displaySingleFile(\'' + catCount + '\')">Display</button>' +
      "</td></tr>";

    $('#fileTable tbody').append(newTableLine);
  }
}

function goBackToAvailableDisks()
{
  $('#diskContentName').html("");
  showElement('availableDisks');
  hideElement('diskContents');
  loadDiskTable();
}

function networkGetBinaryBlob(url)
{
  var loadComplete = $.Deferred();

  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  request.onload = function (loadEvent)
  {
    //binaryDiskBlob = new Blob([request.response], { type: "application/octet-stream" });
    binaryDiskBlob = request.response;
    loadComplete.resolve();
  }

  request.send();

  return loadComplete.promise();
}

function getSixteenBitValueFromBinary(startPos)
{
  var tempArray = new Uint8Array(binaryDiskBlob, startPos, 2);
  var result = (tempArray[1] << 8) + tempArray[0];
  return result;
}

function getEightBitValueFromBinary(startPos)
{
  var result = new Uint8Array(binaryDiskBlob, startPos, 1)[0];
  return result;
}

function getSevenBitValueFromBinary(startPos)
{
  var result = getEightBitValueFromBinary(startPos);
  return  result & 0x7F;
}

function getSevenBitCharFromBinary(startPos)
{
  var result = getSevenBitValueFromBinary(startPos);
  return String.fromCharCode(result);
}

function getTopBitSetFromBinary(startPos)
{
  var result = new Uint8Array(binaryDiskBlob, startPos, 1)[0] & 0x80;
  return (result === 128);
}

function getStringFromBinary(startPos, length)
{
  var tempBuffer = new Uint8Array(binaryDiskBlob, startPos, length);
  return (String.fromCharCode.apply(null, tempBuffer)).trim();
}

function decimalToHex(d, padding)
{
  var hex = Number(d).toString(16).toUpperCase();
  padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

  while (hex.length < padding)
  {
    hex = "0" + hex;
  }

  return hex;
}

function downloadSingleFile(catalogIndex)
{
  console.log(catalog[catalogIndex]);

  var fileItem = catalog[catalogIndex];

  var startOffset = fileItem.startSector * 256; // DFS Disks have 256 bytes per sector
  var fileData = new Uint8Array(binaryDiskBlob, startOffset, fileItem.fileLength);

  var fileName = ((fileItem.fileDirectory === '$') ? '' : fileItem.fileDirectory + "_") +
    fileItem.fileName +
    "_" +
    decimalToHex(fileItem.fileLoad) +
    "_" +
    decimalToHex(fileItem.fileExec) +
    ".bin";

  downloadBinaryData(fileName, fileData);
}

function downloadBinaryData(fileName, fileData)
{
  var blob = new Blob([fileData], { type: "application/octet-stream" });
  var b64Url = URL.createObjectURL(blob);

  var anchorTag = document.createElement("a");
  anchorTag.download = fileName;
  anchorTag.href = b64Url;
  anchorTag.id = 'downloadLink';
  anchorTag.style.display = "none";
  document.body.appendChild(anchorTag);
  anchorTag.click();

  // Wait 2 seconds then remove the link
  setTimeout(function() {
      var aTag = document.getElementById("downloadLink");
      aTag.parentNode.removeChild(aTag);
    },
    2000);
}

function setDispBtn(num)
{
  $('#bdis'+num).removeClass('btn-default');
  $('#bdis'+num).addClass('btn-primary');
}

function resetDispBtn(num)
{
  $('#bdis'+num).removeClass('btn-primary');
  $('#bdis'+num).addClass('btn-default');
}

function displaySingleFile(catalogIndex)
{
  var oldfileid=gFileId;
  gFileId=catalogIndex;
  resetDispBtn(oldfileid);
  setDispBtn(catalogIndex);
  $('#fn').text(catalog[catalogIndex]['fileName']);
  d_text(catalogIndex);
  d_basic(catalogIndex);
  d_hex(catalogIndex);
  d_dis(catalogIndex);
}

function d_text(catalogIndex)
{
  var fileItem = catalog[catalogIndex];

  var startOffset = fileItem.startSector * 256; // DFS Disks have 256 bytes per sector
  var fileData = new Uint8Array(binaryDiskBlob, startOffset, fileItem.fileLength);
  var text = new String;

  for ( var i=0; i<=fileItem.fileLength; i++) {
    if ( fileData[i] < 31 || fileData[i] > 127 ) {
      if (fileData[i]==13) {
        text+="\n";
      } else {
        text += '[' + String("00" + fileData[i].toString(16)).slice(-2)+']';
      }
    } else {
      text+=String.fromCharCode(fileData[i]);
    }
  }
  $('#contentstxt').text(text);
}

function d_hex(catalogIndex)
{

  var fileItem = catalog[catalogIndex];

  var startOffset = fileItem.startSector * 256; // DFS Disks have 256 bytes per sector
  var fileData = new Uint8Array(binaryDiskBlob, startOffset, fileItem.fileLength);

  var c = new String;
  var d = new String;
  var e = new String;
  var hexd = new String;

  var k = 0;
  for ( var i=0; i<=fileItem.fileLength; i+=16) {
    c=String("00000"+i.toString(16)).slice(-5);
    d = "";
    e = "";
    for ( var j=0; j<16; j++ ) {
      k=i+j;
      if ( k < fileItem.fileLength ) {
        d += String("00" + fileData[k].toString(16)).slice(-2);
        if ( j % 2 == 1 ) {
          d += " ";
        }
        if ( fileData[k] > 31 && fileData[k] < 127 ) {
          e += String.fromCharCode(fileData[k]);
        } else {
          e += '.';
        }
      } else {
        d+="  ";
        if ( j % 2 == 1 ) {
          d += " ";
        }
      }
    }
    hexd+=c+" "+d+" "+e+"\n";
    //$('#contents').append(c+" "+d+" "+e+"\n");
  }
  $('#contentshex').text(hexd);
}

function d_basic(catalogIndex)
{

  var fileItem = catalog[catalogIndex];

  var startOffset = fileItem.startSector * 256; // DFS Disks have 256 bytes per sector
  var fileData = new Uint8Array(binaryDiskBlob, startOffset, fileItem.fileLength);

  /* Thanks to https://www.sweharris.org for letting me convert the code in
  *  list.pl part of his MMB_Utils https://github.com/sweharris/MMB_Utils
  *  to javascript and relicense it for use in this code.
  */

  var c = new String;
  var d = new String;
  var e = new String;
  var line = 0;
  var llen = 0;
  var raw = 0;
  var decode = new String;
  var prevchar = new String;
  var listing = new String;
  var lend = 0;
  var lno;
  var n1=0;
  var n2=0;
  var n3=0;
  var low=0;
  var high=0;
  var tokens = new Array();
  tokens[128] = 'AND';     tokens[192] = 'LEFT$(';
  tokens[129] = 'DIV';     tokens[193] = 'MID$(';
  tokens[130] = 'EOR';     tokens[194] = 'RIGHT$(';
  tokens[131] = 'MOD';     tokens[195] = 'STR$';
  tokens[132] = 'OR';      tokens[196] = 'STRING$(';
  tokens[133] = 'ERROR';   tokens[197] = 'EOF';
  tokens[134] = 'LINE';    tokens[198] = 'AUTO';
  tokens[135] = 'OFF';     tokens[199] = 'DELETE';
  tokens[136] = 'STEP';    tokens[200] = 'LOAD';
  tokens[137] = 'SPC';     tokens[201] = 'LIST';
  tokens[138] = 'TAB(';    tokens[202] = 'NEW';
  tokens[139] = 'ELSE';    tokens[203] = 'OLD';
  tokens[140] = 'THEN';    tokens[204] = 'RENUMBER';
  tokens[142] = 'OPENIN';  tokens[205] = 'SAVE';
  tokens[143] = 'PTR';     tokens[207] = 'PTR';
  tokens[144] = 'PAGE';    tokens[208] = 'PAGE';
  tokens[145] = 'TIME';    tokens[209] = 'TIME';
  tokens[146] = 'LOMEM';   tokens[210] = 'LOMEM';
  tokens[147] = 'HIMEM';   tokens[211] = 'HIMEM';
  tokens[148] = 'ABS';     tokens[212] = 'SOUND';
  tokens[149] = 'ACS';     tokens[213] = 'BPUT';
  tokens[150] = 'ADVAL';   tokens[214] = 'CALL';
  tokens[151] = 'ASC';     tokens[215] = 'CHAIN';
  tokens[152] = 'ASN';     tokens[216] = 'CLEAR';
  tokens[153] = 'ATN';     tokens[217] = 'CLOSE';
  tokens[154] = 'BGET';    tokens[218] = 'CLG';
  tokens[155] = 'COS';     tokens[219] = 'CLS';
  tokens[156] = 'COUNT';   tokens[220] = 'DATA';
  tokens[157] = 'DEG';     tokens[221] = 'DEF';
  tokens[158] = 'ERL';     tokens[222] = 'DIM';
  tokens[159] = 'ERR';     tokens[223] = 'DRAW';
  tokens[160] = 'EVAL';    tokens[224] = 'END';
  tokens[161] = 'EXP';     tokens[225] = 'ENDPROC';
  tokens[162] = 'EXT';     tokens[226] = 'ENVELOPE';
  tokens[163] = 'FALSE';   tokens[227] = 'FOR';
  tokens[164] = 'FN';      tokens[228] = 'GOSUB';
  tokens[165] = 'GET';     tokens[229] = 'GOTO';
  tokens[166] = 'INKEY';   tokens[230] = 'GCOL';
  tokens[167] = 'INSTR(';  tokens[231] = 'IF';
  tokens[168] = 'INT';     tokens[232] = 'INPUT';
  tokens[169] = 'LEN';     tokens[233] = 'LET';
  tokens[170] = 'LN';      tokens[234] = 'LOCAL';
  tokens[171] = 'LOG';     tokens[235] = 'MODE';
  tokens[172] = 'NOT';     tokens[236] = 'MOVE';
  tokens[173] = 'OPENUP';  tokens[237] = 'NEXT';
  tokens[174] = 'OPENOUT'; tokens[238] = 'ON';
  tokens[175] = 'PI';      tokens[239] = 'VDU';
  tokens[176] = 'POINT(';  tokens[240] = 'PLOT';
  tokens[177] = 'POS';     tokens[241] = 'PRINT';
  tokens[178] = 'RAD';     tokens[242] = 'PROC';
  tokens[179] = 'RND';     tokens[243] = 'READ';
  tokens[180] = 'SGN';     tokens[244] = 'REM';
  tokens[181] = 'SIN';     tokens[245] = 'REPEAT';
  tokens[182] = 'SQR';     tokens[246] = 'REPORT';
  tokens[183] = 'TAN';     tokens[247] = 'RESTORE';
  tokens[184] = 'TO';      tokens[248] = 'RETURN';
  tokens[185] = 'TRUE';    tokens[249] = 'RUN';
  tokens[186] = 'USR';     tokens[250] = 'STOP';
  tokens[187] = 'VAL';     tokens[251] = 'COLOUR';
  tokens[188] = 'VPOS';    tokens[252] = 'TRACE';
  tokens[189] = 'CHR$';    tokens[253] = 'UNTIL';
  tokens[190] = 'GET$';    tokens[254] = 'WIDTH';
  tokens[191] = 'INKEY$';  tokens[255] = 'OSCLI';


  var i = 0;
  while ( i < fileItem.fileLength ) {
    if ( fileData[i] != 13 ) {
      listing+="Bad Program (expected ^M at start of line).";
      break;
    }
    i++;
    // Line number high
    if ( fileData[i] == 255 ) {
      break;
    }
    if ( fileItem.fileLength < i+2 ) {
      listing+="Bad Program (Line finishes before metadata).";
      break;
    }
    line = fileData[i]*256;
    i++;
    // Line number low
    line = line + fileData[i];
    i++;
    // Line length
    llen = fileData[i]-4;
    if ( llen < 0 ) {
      listing+="Bad Program (Line length too short)";
      break;
    }
    raw=0;  // Set to 1 if in quotes
    decode="";
    prevchar="";
    lend=i+llen;
    if (lend > fileItem.fileLength ) {
      listing+="Bad Program (Line truncated)";
      break;
    }
    // Read rest of line
    while ( i++ < lend ) {
      if (raw == 1) {
        d = String.fromCharCode(fileData[i]);
      } else {
        if (fileData[i] == parseInt("8D",16)) {
          // Line token
          i++;
          n1=fileData[i];
          i++;
          n2=fileData[i];
          i++;
          n3=fileData[i];
          // This comes from page 41 of "The BASIC ROM User Guide"
          n1=(n1*4)&255;
          low=(n1 & 192) ^ n2;
          n1=(n1*4)&255;
          high=n1 ^ n3;
          lno=high*256+low;
          d=lno;
        } else {
          if ( fileData[i] in tokens ) {
            d=tokens[fileData[i]];
          } else {
            d=String.fromCharCode(fileData[i]);
          }
        }
      }
      if (String.fromCharCode(fileData[i]) == '"' ) { raw=1-raw; }
      decode += d;
    }
    listing+=String("     "+line).slice(-6)+decode+"\n";
  }
  $('#contentsbas').html(listing);
}

function d_dis(catalogIndex)
{

  var fileItem = catalog[catalogIndex];

  var startOffset = fileItem.startSector * 256; // DFS Disks have 256 bytes per sector
  var fileData = new Uint8Array(binaryDiskBlob, startOffset, fileItem.fileLength);

  var c = new String;
  var d = new String;
  var e = new String;

  var k = 0;
  $('#contentsdis').text("Not implemented yet.");
}

