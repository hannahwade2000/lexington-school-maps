// CONFIGURE these as needed:
const geojsonUrl = 'data/elementary_zones.geojson' ; 'data/middle_zones.geojson' ; 'data_high_zones.geojson'
const capacityUrl = 'data/school_capacities.json';
const schoolType = 'elementary'; 'middle'; 'high';

const startYear = 2023;
const endYear = 2036;

// Utility to get color based on % used
function getColor(percent) {
    if (percent >= 95) return '#e74c3c';     // red
    if (percent = 86-94 ) return '#f1c40f';      // yellow
    if (percent <=85 ) return '#2ecc40';                         // green

}
// Map + TimeDimension setup
var map = L.map('map', {
    center: [33.96, -81.23], /* Lexington County center */
    zoom: 10,
    timeDimension: true,
    timeDimensionControl: true,
    timeDimensionOptions: {
        timeInterval: `${startYear}-01-01/${endYear}-12-31`,
        period: "P1Y"
    },
    timeDimensionControlOptions: {
        autoPlay: false,
        minSpeed: 1,
        speedStep: 1,
        maxSpeed: 5,
        timeSliderDragUpdate: true
    }
});

// Load base map layer (optional)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Load capacity data
let schoolCapacities = {};
fetch(capacityUrl)
  .then(response => response.json())
  .then(data => {
      // Map each school_id to its capacity projection object
      data.forEach(school => {
          if (school.type === schoolType) {
              schoolCapacities[school.school_id] = school.capacity;
          }
      });

      // Then load zones and render!
      fetch(geojsonUrl)
        .then(r => r.json())
        .then(geojsonData => {
            // Build time-aware layer
            let geojsonLayer = L.geoJSON(geojsonData, {
                style: function(feature) {
                  // Default style, will be updated dynamically later
                  return {color: "#888", fillColor: "#ccc", weight: 1, fillOpacity: 0.7, opacity: 1};
                },
                onEachFeature: function (feature, layer) {
                  // Add popups with info
                  let schoolId = feature.properties.school_id || feature.properties.School_ID;
                  let name = feature.properties.name || feature.properties.School_Name || 'Unknown School';
                  layer.bindTooltip(name, {permanent: false});
                  layer.bindPopup(`<b>${name}</b><br>School ID: ${schoolId}`);
                }
            });

            // Wrap this layer in a TimeDimension Layer
            let tdGeojsonLayer = L.timeDimension.layer.geoJson(geojsonLayer, {
                updateTimeDimension: true,
                updateTimeDimensionMode: 'union',
                addlastPoint: false,
                duration: 'P1Y',
                // This function updates styles per time/time index
                // It is called automatically by the plugin
                // You can use 'setStyle' on layers inside
                // As we have P1Y, the active year is just the time
                // You may need to manually handle the first time update.
                // But let's write a listener instead:
            });

            tdGeojsonLayer.addTo(map);

            // Function to restyle zones by year (% used/color)
            function restyleZones(currentYear) {
              geojsonLayer.eachLayer(function(layer) {
                  let schoolId = layer.feature.properties.school_id || layer.feature.properties.School_ID;
                  let percent = schoolCapacities[schoolId] ? schoolCapacities[schoolId][currentYear] : null;
                  let color = percent !== null && percent !== undefined ? getColor(percent) : '#ccc';
                  layer.setStyle({fillColor: color, color: '#555'});
                  // Optionally, update popup/tooltip too:
                  let name = layer.feature.properties.name || layer.feature.properties.School_Name || 'Unknown School';
                  let content = `<b>${name}</b><br>Capacity (${currentYear}): ${percent !== null && percent !== undefined ? percent + '%' : 'N/A'}`;
                  layer.bindPopup(content);
              });
            }

            // Listen for time changes to update styles
            map.timeDimension.on('timeload', function(e) {
                let date = map.timeDimension.getCurrentTime();
                let year = new Date(date).getFullYear();
                restyleZones(year);
            });

            // Trigger style for initial year
            restyleZones(startYear);
        });
  });
