(function () {
    "use strict";
    var SECTOR_SIZE = 4096, SECTOR_DATA = 3968;
    var ORDERS = [
    [0,1,2,3], [0,1,3,2], [0,2,1,3], [0,3,1,2], [0,2,3,1], [0,3,2,1],
    [1,0,2,3], [1,0,3,2], [2,0,1,3], [3,0,1,2], [2,0,3,1], [3,0,2,1],
    [1,2,0,3], [1,3,0,2], [2,1,0,3], [3,1,0,2], [2,3,0,1], [3,2,0,1],
    [1,2,3,0], [1,3,2,0], [2,1,3,0], [3,1,2,0], [2,3,1,0], [3,2,1,0]
];
    var NATURES = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];
    function u16(d,o){return d.getUint16(o,true);}
    function u32(d,o){return d.getUint32(o,true);}
    function scanCopy(d, start) {
        var sectors={}, indexes=[];
        for(var i=0;i<14;i++) {
            var off=start+i*SECTOR_SIZE, id=u16(d,off+4084), signature=u32(d,off+4088);
            if(signature!==0x08012025 || id>13 || sectors[id]!==undefined) return null;
            sectors[id]=off;
            indexes.push(u32(d,off+4092));
        }
        if(Object.keys(sectors).length!==14 || indexes.some(function(x){return x!==indexes[0];})) return null;
        return {sectors:sectors,index:indexes[0]};
    }
    // Box PokÃƒÂ©mon store experience, not level. For ROM hacks, growth groups can be
    // supplied by window.ROM_GROWTH_RATES (keyed by numeric species ID).
    // Standard Oddish uses Medium Slow. Unknown species default to Medium Fast,
    // and are flagged as estimates in the preview.
    function growthGroup(species) {
        var groups = window.ROM_GROWTH_RATES || {};
        return groups[species] || (species === 246 ? "slow" : species === 43 ? "medium-slow" : "medium-fast");
    }
    function expAtLevel(n, group) {
        var v;
        if (group === "fast") v = 4 * n*n*n / 5;
        else if (group === "slow") v = 5 * n*n*n / 4;
        else if (group === "medium-slow") v = 6*n*n*n/5 - 15*n*n + 100*n - 140;
        else if (group === "erratic") v = n <= 50 ? n*n*n*(100-n)/50 : n <= 68 ? n*n*n*(150-n)/100 : n <= 98 ? n*n*n*Math.floor((1911-10*n)/3)/500 : n*n*n*(160-n)/100;
        else if (group === "fluctuating") v = n <= 15 ? n*n*n*(Math.floor((n+1)/3)+24)/50 : n <= 36 ? n*n*n*(n+14)/50 : n*n*n*(Math.floor(n/2)+32)/50;
        else v = n*n*n;
        return Math.max(0, Math.floor(v));
    }
    function experienceLevel(exp, species) {
        var group = growthGroup(species);
        for (var n = 100; n >= 2; n--) if (exp >= expAtLevel(n, group)) return n;
        return 1;
    }
    function readBoxData(d, sectors) {
        var bytes = new Uint8Array(9 * SECTOR_DATA);
        for (var i = 0; i < 9; i++) {
            bytes.set(new Uint8Array(d.buffer, d.byteOffset + sectors[i+5], SECTOR_DATA), i * SECTOR_DATA);
        }
        var pc = new DataView(bytes.buffer);
        var result = [[], []];
        // PCStorage: u32 currentBox, followed by 14 boxes * 30 * 80-byte BoxPokemon.
        for (var box = 0; box < 2; box++) for (var slot = 0; slot < 30; slot++) {
            var off = 4 + (box * 30 + slot) * 80;
            if (!u32(pc, off) && !u32(pc, off+4)) continue;
            try {
                var mon = readPartyMon(pc, off, true);
                if (mon) {
                    mon.boxSlot = slot + 1;
                    mon.levelEstimated = !((window.ROM_GROWTH_RATES || {})[mon.speciesId] || mon.speciesId === 43);
                    result[box].push(mon);
                }
            } catch (e) { throw Error("PC Box " + (box+1) + ", slot " + (slot+1) + ": " + e.message); }
        }
        return result;
    }
    function readPartyMon(d,off,isBox) {
        var personality=u32(d,off), ot=u32(d,off+4), checksum=u16(d,off+28);
        if(!personality && !ot) return null;
        var key=(personality^ot)>>>0, order=ORDERS[personality%24], sub=[[],[],[],[]], sum=0;
        for(var part=0;part<4;part++) for(var j=0;j<3;j++) {
            var word=(u32(d,off+32+order[part]*12+j*4)^key)>>>0;
            sub[part].push(word);
            sum=(sum+(word&65535)+(word>>>16))&65535;
        }
        if(sum!==checksum) throw Error("PokÃƒÂ©mon checksum mismatch at offset " + off);
        var g=sub[0],a=sub[1],e=sub[2],m=sub[3],iv=m[1];
var species = g[0] & 2047, exp = g[1] & 0x1fffff;
// Some older Rhombus saves contain non-EXP data in the upper 16 bits of
// this particular Larvitar's experience field. Recover its 16-bit EXP only
// when the complete value is impossible for the species at level 100.

var level=isBox ? experienceLevel(exp, species) : d.getUint8(off+84);
        if(!species || !level || level>100) throw Error("Invalid species or level in party data");
        return {personality:personality,ot:ot,speciesId:species,experience:exp,boxed:!!isBox,itemId:g[0]>>>16,level:level,
            moveIds:[a[0]&65535,a[0]>>>16,a[1]&65535,a[1]>>>16],
            evs:{hp:e[0]&255,at:(e[0]>>>8)&255,df:(e[0]>>>16)&255,sp:(e[0]>>>24)&255,sa:e[1]&255,sd:(e[1]>>>8)&255},
            ivs:{hp:iv&31,at:(iv>>>5)&31,df:(iv>>>10)&31,sp:(iv>>>15)&31,sa:(iv>>>20)&31,sd:(iv>>>25)&31},
           nature:NATURES[personality%25],abilitySlot:(m[2]>>>29)&3};
    }
    function parse(bytes) {
        if(bytes.byteLength!==131072 && bytes.byteLength!==131088) throw Error("Expected a 128 KB Emerald .sav (131072 or 131088 bytes), not a save state.");
        var d=new DataView(bytes), a=scanCopy(d,0),b=scanCopy(d,57344);
        if(!a&&!b) throw Error("No valid Emerald sector layout found. This hack may use a different save format.");
        var chosen=!a?b:!b?a:((b.index-a.index)>>>0)<0x80000000?b:a;
        var off=chosen.sectors[1], count=u32(d,off+564);
        if(count>6) throw Error("Invalid party size: "+count);
        var mons=[];
        for(var i=0;i<count;i++) mons.push(readPartyMon(d,off+568+i*100,false));
        return {team:mons,box1:readBoxData(d,chosen.sectors)[0],box2:readBoxData(d,chosen.sectors)[1]};
    }
    function showStatus(message){$("#sav-import-status").text(message);}
    function init(){
        var panel=$("<div>").attr("id","sav-party-import").css({margin:"8px 0",padding:"8px",border:"1px solid #888",borderRadius:"5px"});
        $("<strong>").text("Import Team + PC Boxes 1 and 2 from Emerald .sav").appendTo(panel);
        $("<div>").text("Select a .sav file to preview your Team and PC Boxes 1 and 2. Import updates your Team and Boxes to match your save file.").css({fontSize:"12px",margin:"5px 0"}).appendTo(panel);
        var file=$("<input>").attr({type:"file",accept:".sav,application/octet-stream",id:"sav-party-file"}).appendTo(panel);
var importButton = $("<button>")
    .attr({type:"button",id:"sav-import-team"})
    .text("Import Team + Boxes 1 and 2")
    .prop("disabled",true)
    .css({margin:"8px",padding:"5px 12px"})
    .appendTo(panel);
        $("<pre>").attr("id","sav-import-status").css({whiteSpace:"pre-wrap",fontSize:"12px",maxHeight:"260px",overflow:"auto"}).appendTo(panel);
        var target=$("#saveToTeam");
        $(".poke-import").append(panel);
        file.on("change",function(){
            var f=this.files&&this.files[0];if(!f)return;this.value="";console.log("NEW SAV SELECTED:",f.name,"Size:",f.size,"Modified:",f.lastModified);
            showStatus("Reading " + f.name + "...");
            var reader=new FileReader();
            reader.onerror=function(){showStatus("Could not read the file.");};
            reader.onload=function(){
                try {
                    var parsed=parse(reader.result);
                    window.emeraldSavPartyPreview=parsed;
                    importButton.prop("disabled", !(parsed.team.length || parsed.box1.length || parsed.box2.length));
                    var lines=[];
                    [["Team",parsed.team],["PC Box 1",parsed.box1],["PC Box 2",parsed.box2]].forEach(function(section){
                        lines.push(section[0]+": "+section[1].length+" PokÃƒÂ©mon");
                        section[1].forEach(function(p,i){lines.push("  "+(p.boxSlot || i+1)+". Species ID "+p.speciesId+" | Lv "+p.level+(p.levelEstimated ? " (estimated)" : "")+" | moves "+p.moveIds.join(", "));});
                    });
                    lines.push("", "Preview only; click Import to add missing PokÃƒÂ©mon.");
                    showStatus(lines.join("\n"));
                }catch(e){
    window.emeraldSavPartyPreview=null;
    importButton.prop("disabled",true);
    showStatus("Import preview failed: "+e.message);
}
            };
            reader.readAsArrayBuffer(f);
        });
    }
    $(document).on("click", "#sav-import-team", function () {
        if (!window.emeraldSavPartyPreview) {
            alert("Please select a valid .sav file first.");
            return;
        }

        if (typeof window.addSavPokemonToSection !== "function") {
            alert("Team storage is not available.");
            return;
        }

        var romIds = window.ROM_IDS;

if (!romIds) {
    alert("ROM ID database is not loaded.");
    return;
}

function formatRomName(value) {
    return value.toLowerCase()
        .split("_")
        .map(function (part) {
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(" ");
}

var speciesNames = {};
var moveNames = {};

Object.keys(romIds.species).forEach(function (id) {
    var rawName = romIds.species[id];
    var name = formatRomName(rawName);

    ["ALOLA", "GALAR", "HISUI", "PALDEA"].forEach(function (region) {
        if (rawName.endsWith("_" + region)) {
            var suffix = {
                ALOLA: "Alola",
                GALAR: "Galar",
                HISUI: "Hisui",
                PALDEA: "Paldea"
            }[region];

            name = formatRomName(rawName.slice(0, -(region.length + 1))) + "-" + suffix;
        }
    });

    var dex = window.calc && window.calc.SPECIES &&
              window.calc.SPECIES[9];

    if (dex && !dex[name]) {
        var specialNames = {
            FARFETCHD: "Farfetch’d",
            MR_MIME: "Mr. Mime",
            MIME_JR: "Mime Jr.",
            MR_RIME: "Mr. Rime",
            HO_OH: "Ho-Oh",
            PORYGON_Z: "Porygon-Z",
            SIRFETCHD: "Sirfetch’d",
            TYPE_NULL: "Type: Null",
            JANGMO_O: "Jangmo-o",
            HAKAMO_O: "Hakamo-o",
            KOMMO_O: "Kommo-o"
        };

        var candidates = [
            specialNames[rawName],
            name.replace(/ /g, "-"),
            name.replace(/ Mega X$/, "-Mega-X"),
            name.replace(/ Mega Y$/, "-Mega-Y"),
            name.replace(/ Mega$/, "-Mega"),
            name.replace(/ Primal$/, "-Primal"),
            name.replace(/ Alola$/, "-Alola"),
            name.replace(/ Galar$/, "-Galar"),
            name.replace(/ Hisui$/, "-Hisui"),
            name.replace(/ Paldea$/, "-Paldea")
        ];

        for (var c = 0; c < candidates.length; c++) {
            if (candidates[c] && dex[candidates[c]]) {
                name = candidates[c];
                break;
            }
        }
    }

    var regionalOverrides = {
        FARFETCHD_GALAR: "Farfetch’d-Galar",
        MR_MIME_GALAR: "Mr. Mime-Galar",
        DARMANITAN_GALAR_STANDARD: "Darmanitan-Galar"
    };

    if (regionalOverrides[rawName]) {
        name = regionalOverrides[rawName];
    }

    var defaultFormOverrides = {
        CASTFORM_NORMAL: "Castform",
        DEOXYS_NORMAL: "Deoxys",
        BURMY_PLANT: "Burmy",
        WORMADAM_PLANT: "Wormadam",
        CHERRIM_OVERCAST: "Cherrim",
        GIRATINA_ALTERED: "Giratina",
        SHAYMIN_LAND: "Shaymin",
        ARCEUS_NORMAL: "Arceus",
        DARMANITAN_STANDARD: "Darmanitan",
        SAWSBUCK_SPRING: "Sawsbuck",
        TORNADUS_INCARNATE: "Tornadus",
        THUNDURUS_INCARNATE: "Thundurus",
        LANDORUS_INCARNATE: "Landorus",
        KELDEO_ORDINARY: "Keldeo",
        MELOETTA_ARIA: "Meloetta"
    };

    if (defaultFormOverrides[rawName]) {
        name = defaultFormOverrides[rawName];
    }

    // Match Flabebe flower colors to the calculator's exact Unicode name.
    if (/^FLABEBE_(RED|YELLOW|ORANGE|BLUE|WHITE)$/.test(rawName)) {
        var flabebeName = Object.keys(calc.SPECIES[9]).find(function (key) {
            return key.normalize("NFC") === "Flabébé";
        });
        if (flabebeName) name = flabebeName;
    }

    // Cosmetic flower colors share their base species stats.
    if (/^FLOETTE_(RED|YELLOW|ORANGE|BLUE|WHITE)$/.test(rawName)) {
        name = "Floette";
    }
    if (/^FLORGES_(RED|YELLOW|ORANGE|BLUE|WHITE)$/.test(rawName)) {
        name = "Florges";
    }
    if (rawName === "FLOETTE_ETERNAL") {
        name = "Floette-Eternal";
    }

    // Seasonal and East/West forms share base stats.
    if (/^DEERLING_(SPRING|SUMMER|AUTUMN|WINTER)$/.test(rawName)) {
        name = "Deerling";
    }
    if (/^SAWSBUCK_(SPRING|SUMMER|AUTUMN|WINTER)$/.test(rawName)) {
        name = "Sawsbuck";
    }
    if (/^SHELLOS_(WEST|EAST)$/.test(rawName)) {
        name = "Shellos";
    }
    if (/^GASTRODON_(WEST|EAST)$/.test(rawName)) {
        name = "Gastrodon";
    }

    // Preserve Basculin's three forms.
    var basculinOverrides = {
        BASCULIN_RED_STRIPED: "Basculin",
        BASCULIN_BLUE_STRIPED: "Basculin-Blue-Striped",
        BASCULIN_WHITE_STRIPED: "Basculin-White-Striped"
    };
    if (basculinOverrides[rawName]) {
        name = basculinOverrides[rawName];
    }

    speciesNames[id] = name;
});

Object.keys(romIds.moves).forEach(function (id) {
    moveNames[id] = formatRomName(romIds.moves[id]);
});

var sectionsToImport = window.emeraldSavPartyPreview;
var prepared = [];

for (var sectionName of ["team", "box1", "box2"]) {
for (var i = 0; i < sectionsToImport[sectionName].length; i++) {
    var mon = sectionsToImport[sectionName][i];
    var name = speciesNames[mon.speciesId];
    if (name === "Deerling Spring") name = "Deerling";

    var genderNames = {
        29: "Nidoran-F",
        32: "Nidoran-M",
        678: "Meowstic",
        1155: "Meowstic-F",
        876: "Indeedee",
        1225: "Indeedee-F",
        902: "Basculegion",
        1234: "Basculegion-F",
        1299: "Oinkologne",
        1300: "Oinkologne-F"
    };

    if (genderNames[mon.speciesId]) {
        name = genderNames[mon.speciesId];
    }
    if (mon.speciesId === 29) name = "Nidoran-F";
    if (mon.speciesId === 32) name = "Nidoran-M";

    if (!name) {
        alert("Unknown species ID: " + mon.speciesId);
        return;
    }

    var moves = mon.moveIds.filter(function (id) {
        return id !== 0;
    }).map(function (id) {
        return moveNames[id];
    });

    if (moves.some(function (move) { return !move; })) {
        alert("Unknown move ID for " + name);
        return;
    }

    prepared.push({
        targetSection: sectionName,
        name: name,
        nameProp: "Save-" + mon.personality,
        level: mon.level,
        nature: mon.nature,
         moves: moves,
        ivs: mon.ivs,
        evs: mon.evs,
        item: mon.itemId === 0 ? "" : formatRomName(romIds.items[mon.itemId] || ""),
        ability: (function () {
    var speciesKey = romIds.species[mon.speciesId];
    var slots = window.ROM_ABILITIES && window.ROM_ABILITIES[speciesKey];

    if (!slots || !slots[mon.abilitySlot] || slots[mon.abilitySlot] === "NONE") {
        return undefined;
    }

    return formatRomName(slots[mon.abilitySlot]);
})(),
        isCustomSet: true
    });
}
}

var sections = {
    team: [],
    box1: [],
    box2: []
};

for (var j = 0; j < prepared.length; j++) {
    var poke = prepared[j];

    addToDex(poke);

    sections[poke.targetSection].push({
        pokemon: poke.name,
        set: poke.nameProp
    });
}

if (typeof window.syncSavPokemonStorage !== "function") {
    alert("Save synchronization is not available.");
    return;
}

if (!window.syncSavPokemonStorage(sections)) {
    alert("Could not synchronize the save file.");
    return;
}

alert(
    "Save synchronized successfully!\n" +
    "Team: " + sections.team.length + "\n" +
    "Box 1: " + sections.box1.length + "\n" +
    "Box 2: " + sections.box2.length
);
    });

    $(init);
})();















