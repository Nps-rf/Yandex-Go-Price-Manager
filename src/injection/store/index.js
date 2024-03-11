export default class AppState {
  constructor() {
    this.detailsState = new Map();
    this.uniquePricesByLevel = {};
    this.timerState = new Map();
    this.offers = {};
    this.routeChanged = false;
    this.currentRoute = undefined;
    this.routeStates = {};
  }

  resetState() {
    this.detailsState.clear();
    this.uniquePricesByLevel = {};
    this.timerState.clear();
    this.offers = {};
    this.routeChanged = false;
  }
}
