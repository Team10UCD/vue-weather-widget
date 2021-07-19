import Utils from "./utils";
import Skycon from "vue-skycons";

export default {
  name: "VueWeatherWidget",

  components: {
    Skycon,
  },

  props: {
    // Pass true to use DarkSky API, otherwise it will use OpenWeatherMap API
    useDarkSkyApi: {
      type: Boolean,
      default: false,
    },

    // Your Dark Sky / OpenWeatherMap secret key
    apiKey: {
      type: String,
      //required: true,
    },

    // Address to lookup location.
    address: {
      type: String,
    },

    // (Local) server URL to query for data
    /* by default, it will query the local window hostname
    under the assumption that you are hosting your frontend
    and backend from the same URL; using the window name 
    facilitates easier development, but may pose a minor security risk.
    you can hardcode a URL if needed/desired below:
    */
    serverURL: {
      type: String,
      required: true,
      //default: ("https://" + window.location.hostname + "/weather")
      default: ("https://localhost/weather")
    },

    // The latitude of a location (in decimal degrees).
    // Positive is north, negative is south.
    latitude: {
      type: String,
    },

    // The longitude of a location (in decimal degrees).
    // Positive is east, negative is west.
    longitude: {
      type: String,
    },

    // Return summary properties in the desired language.
    // For list of supported languages, visit https://darksky.net/dev/docs/forecast
    language: {
      type: String,
      default: "en",
    },

    // Return weather conditions in the requested units.
    // For list of supported units, visit https://darksky.net/dev/docs/forecast
    units: {
      type: String,
      default: "us",
    },

    // Controls whether to show or hide the title bar.
    hideHeader: {
      type: Boolean,
      default: false,
    },

    // Auto update interval in milliseconds
    updateInterval: {
      type: Number,
    },

    // Use static skycons
    disableAnimation: {
      type: Boolean,
      default: false,
    },

    // Color of the Temparature bar. Default: '#444'
    barColor: {
      type: String,
      default: "#444",
    },

    // Color of the text. Default: '#333'
    textColor: {
      type: String,
      default: "#333",
    },

    // Your positionstack api key for geocoding
    positionstackApi: {
      type: String,
      default: "c3bb8aa0a56b21122dea6a2a8ada70c8",
    },

    // Your ipregistry key to get location from ip address
    ipregistryKey: {
      type: String,
      default: "f8n4kqe8pv4kii",
    },
  },

  data() {
    return {
      loading: true,
      weather: null,
      error: null,
      location: {},
      timeout: null,
    };
  },

  watch: {
    apiKey: "hydrate",
    address: "hydrate",
    latitude: "hydrate",
    longitude: "hydrate",
    language: "hydrate",
    units: "hydrate",
    updateInterval: "hydrate",
  },

  mounted() {
    this.hydrate();
  },

  destroyed() {
    clearTimeout(this.timeout);
  },

  computed: {
    currently() {
      return this.weather.currently;
    },
    isDownward() {
      const hourly = this.weather.hourly.data;
      const time = new Date().getTime() / 1e3;
      for (let i = 0; i < hourly.length; i++) {
        if (hourly[i].time <= time) continue;
        return hourly[i].temperature < this.currently.temperature;
      }
    },
    windBearing() {
      const t = Math.round(this.currently.windBearing / 45);
      return ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"][t];
    },
    daily() {
      const forecasts = [];
      let globalMaxTemp = -Infinity;
      let globalMinTemp = Infinity;

      const tomorrow = new Date(new Date().toDateString());
      const today = tomorrow.getTime() / 1e3 + 24 * 3600 - 1;

      const daily = this.weather.daily.data;
      for (let i = 0; i < daily.length; i++) {
        const day = daily[i];
        if (day.temperatureMax > globalMaxTemp) {
          globalMaxTemp = day.temperatureMax;
        }
        if (day.temperatureMin < globalMinTemp) {
          globalMinTemp = day.temperatureMin;
        }
        forecasts.push(Object.assign({}, day));
      }

      const tempRange = globalMaxTemp - globalMinTemp;
      for (let i = 0; i < forecasts.length; ++i) {
        const day = forecasts[i];
        if (day.time <= today) {
          day.weekName = "Today";
        } else {
          day.weekName = new Date(day.time * 1000).toLocaleDateString(this.language, {
            weekday: "short",
          });
        }
        const max = day.temperatureMax;
        const min = day.temperatureMin;
        day.height = Math.round((100 * (max - min)) / tempRange);
        day.top = Math.round((100 * (globalMaxTemp - max)) / tempRange);
        day.bottom = 100 - (day.top + day.height);
      }
      return forecasts;
    },
  },

  methods: {
    /*
    loadWeather() {
      const fetchWeatherMethod = this.useDarkSkyApi ? Utils.fetchWeather : Utils.fetchOWMWeather;
      return fetchWeatherMethod({
        apiKey: this.apiKey,
        lat: this.location.lat,
        lng: this.location.lng,
        units: this.units,
        language: this.language,
      }).then((data) => {
        this.$set(this, "weather", data);
      });
    },
    */

    loadWeather() {
      console.log(this.serverURL)
      //const fetchWeatherMethod = this.useDarkSkyApi ? Utils.fetchWeather : Utils.fetchOWMWeather;
      return Utils.fetchServerWeather({
        serverURL: this.serverURL, //use default serverURL value, or specify here/with paramater if necessary
      }).then((data) => {
        this.$set(this, "weather", data);
      });
    },

    autoupdate() {
      clearTimeout(this.timeout);
      const time = Number(this.updateInterval);
      if (!time || time < 60 || this.destroyed) {
        return;
      }
      this.timeout = setTimeout(() => this.hydrate(false), time);
    },

    hydrate(setLoading = true) {
      this.$set(this, "loading", setLoading);
      return this.$nextTick()
        //.then(this.processLocation)
        .then(this.loadWeather)
        .then(() => {
          this.$set(this, "error", null);
        })
        .catch((err) => {
          this.$set(this, "error", "" + err);
        })
        .finally(() => {
          this.$set(this, "loading", false);
          this.autoupdate();
        });
    },

    processLocation() {
      if (!this.latitude || !this.longitude) {
        if (!this.address) {
          return Utils.fetchLocationByIP(this.ipregistryKey).then((data) => {
            this.$set(this, "location", {
              lat: data.latitude,
              lng: data.longitude,
              name: `${data.city}, ${data.country.name}`,
            });
          });
        } else {
          return Utils.geocode(this.positionstackApi, this.address).then((data) => {
            this.$set(this, "location", {
              lat: data.latitude,
              lng: data.longitude,
              name: `${data.region}, ${data.country}`,
            });
          });
        }
      } else {
        return Utils.reverseGeocode(this.positionstackApi, this.latitude, this.longitude).then(
          (data) => {
            this.$set(this, "location", {
              lat: this.latitude,
              lng: this.longitude,
              name: `${data.region}, ${data.country}`,
            });
          }
        );
      }
    },
  },
};
