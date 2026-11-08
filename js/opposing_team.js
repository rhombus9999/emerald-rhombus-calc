$(function () {
    var trainers = [
    "May - route 103",
    "Grunt - Petalburg woods",
    "Red - route 116",
    "Roxanne",
    "Grunt - Rusturf Tunnel ",
    "Brawly",
    "MEL & PAUL",
    "Grunt - Museum 1",
    "Grunt - Museum 2",
    "May - route 110",
    "Noland - route 110",
    "BRANDI & AISHA",
    "MELINA",
    "Wade",
    "Winstrate RTE 111 - VICTOR",
    "Winstrate RTE 111 - VICTORIA",
    "Winstrate RTE 111 - VICKY",
    "Winstrate RTE 111 - VIVI",
    "Wally - Mauville",
    "Wattson",
    "Lung",
    "Tucker & Greta",
    "Sophie",
    "Red - Route 114",
    "TABITHA - Mt. Chimney",
    "MAXIE - Mt. Chimney",
    "FLANNERY",
    "Norman",
    "JACLYN",
    "KOICHI - Route 115",
    "Perry",
    "SHELLY - Weather Institute",
    "May - route 119",
    "Noland - route 119",
    "Hugh",
    "Winona",
    "Greta & Tucker - route 121",
    "KINDRA & ED - Route 123",
    "May - Lilycove",
    "Red - Lilycove",
    "DEZ & LUKE",
    "GRUNT - Mt. Pyre 4",
    "PRESLEY & AURON",
    "TABITHA - Magma Hideout",
    "MAXIE - Magma Hideout",
    "MATT",
    "TATE & LIZA",
    "TABITHA & MAXIE - Mossdeep",
    "SHELLY - Seafloor Cavern",
    "ARCHIE",
    "JUAN",
    "ALEX & KELVIN",
    "WALLY Victory Road",
    "GRETA & TUCKER Victory road",
    "NOLAND victory road",
    "SIDNEY",
    "PHOEBE",
    "GLACIA",
    "DRAKE",
    "RED - CHAMPION"
];

    var displayNames = {
        "MEL & PAUL": "MEL & PAUL - Route 109 (Optional)",
        "BRANDI & AISHA": "BRANDI & AISHA - Route 117 (Optional)",
        "MELINA": "MELINA - Route 117 (Optional)",
        "Wade": "Wade - Route 118 (Optional)",
        "Winstrate RTE 111 - VICTOR": "Winstrate RTE 111 - VICTOR (Optional)",
        "Winstrate RTE 111 - VICTORIA": "Winstrate RTE 111 - VICTORIA (Optional)",
        "Winstrate RTE 111 - VICKY": "Winstrate RTE 111 - VICKY (Optional)",
        "Winstrate RTE 111 - VIVI": "Winstrate RTE 111 - VIVI (Optional)",
        "Lung": "Lung - Route 113 (Optional)",
        "Sophie": "Sophie - Route 113 (Optional)",
        "JACLYN": "JACLYN - Route 110 (Optional)",
        "KOICHI - Route 115": "KOICHI - Route 115 (Optional)",
        "Perry": "Perry - Route 118 (Optional)",
        "Hugh": "Hugh - Route 119 (Optional)",
        "DEZ & LUKE": "DEZ & LUKE - Mt. Pyre 2F (Optional)",
        "PRESLEY & AURON": "PRESLEY & AURON - Route 125 (Optional)",
        "ALEX & KELVIN": "ALEX & KELVIN - Route 134 (Optional)",
        "KINDRA & ED - Route 123": "KINDRA & ED - Route 123 (Optional)"
    };

    var trainerIndex = 0;

    function renderOpposingTeam() {
        var trainerName = trainers[trainerIndex];
        var customSets = {};

        try {
            customSets = JSON.parse(localStorage.customsets || "{}");
        } catch (e) {
            console.error("Could not read imported custom sets.", e);
            return;
        }

        var team = [];

        Object.keys(customSets).forEach(function (pokemon) {
            if (!customSets[pokemon]) return;

            Object.keys(customSets[pokemon]).forEach(function (setName) {
                if (setName === trainerName ||
                    (trainerName === "MELINA" && setName.indexOf("MELINA ") === 0)) {
                    team.push({
                        pokemon: pokemon,
                        setName: setName
                    });
                }
            });
        });

        $("#opposingTrainerName").text(displayNames[trainerName] || trainerName);
        $("#previousTrainer").prop("disabled", trainerIndex === 0);
        $("#nextTrainer").prop("disabled", trainerIndex === trainers.length - 1);
        $("#opposingTeamPokemon").empty();

        team.forEach(function (entry) {
            var pokemon = entry.pokemon;
            var setName = entry.setName;
            var set = customSets[pokemon][setName];
            var card = $("<button>", {
                type: "button",
                class: "team-pokemon"
            });

            var sprite = $("<img>", {
                src: "https://play.pokemonshowdown.com/sprites/gen5/" + pokemon.toLowerCase().replace(/ /g, "-").replace("tauros-paldea-combat", "tauros-paldeacombat").replace("tauros-paldea-blaze", "tauros-paldeablaze").replace("zygarde-10%", "zygarde-10").replace("oricorio-pom-pom", "oricorio-pompom").replace("porygon-z", "porygonz").replace("iron-treads", "irontreads").replace("tapu-koko", "tapukoko").replace("tapu-fini", "tapufini").replace("mr-mime", "mrmime").replace("mr.-mime", "mrmime").replace("sirfetch'd", "sirfetchd").replace("sirfetchd", "sirfetchd").replace("sirfetchâ€™d", "sirfetchd").replace("brute-bonnet", "brutebonnet").replace("walking-wake", "walkingwake").replace("urshifu-rapid-strike", "urshifu-rapidstrike").replace("flutter-mane", "fluttermane").replace("roaring-moon", "roaringmoon").replace("chien-pao", "chienpao").replace("scream-tail", "screamtail") + ".png",
                alt: pokemon,
                class: "team-pokemon-sprite"
            });

            var label = $("<div>", {
                class: "team-pokemon-label",
                text: pokemon + " Lv. " + (set.level || 100)
            });

            card.append(sprite, label);

            card.on("click", function () {
                var selector = $("#p2 input.set-selector");
                var option = getSetOptions().filter(function (x) { return x.pokemon === pokemon && x.set === setName; })[0];
                if (!option) return;
                selector.select2("data", option);
                selector.trigger("change");
                selector.select2("data", option);

                $("#opposingTeamPokemon .team-pokemon").removeClass("selected");
                card.addClass("selected");
            });

            $("#opposingTeamPokemon").append(card);
        });
    }

    $("#previousTrainer").on("click", function () {
        if (trainerIndex > 0) {
            trainerIndex--;
            renderOpposingTeam();
        }
    });

    $("#nextTrainer").on("click", function () {
        if (trainerIndex < trainers.length - 1) {
            trainerIndex++;
            renderOpposingTeam();
        }
    });

    renderOpposingTeam();
});































