(function () {
    fetch("./js/rhombus_public_trainers.json")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Trainer database not found");
            }
            return response.json();
        })
        .then(function (trainers) {
            var existing = {};

            try {
                existing = JSON.parse(
                    localStorage.getItem("customsets") || "{}"
                );
            } catch (e) {}

            Object.keys(trainers).forEach(function (species) {
                existing[species] = Object.assign(
                    {},
                    trainers[species],
                    existing[species] || {}
                );
            });

            localStorage.setItem(
                "customsets",
                JSON.stringify(existing)
            );

            window.dispatchEvent(new Event("rhombus-trainers-loaded")); console.log("Rhombus trainer database loaded");
        })
        .catch(function (error) {
            console.error("Trainer database error:", error);
        });
})();

