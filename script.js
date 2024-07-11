'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllBtn = document.querySelector('.btn-delete-all');
const alertWindow = document.querySelector('.alert-window');
const alertWindowClose = document.querySelector('.alert-window .error__close');
const sortBtn = document.querySelector('.btn-sort');
const filterDiv = document.querySelector('.filters');
const allFilterBtns = document.querySelectorAll('.filters .btn');

class Workout {
  date = new Date();
  clicks = 0;
  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lang]
    this.distance = distance; // km
    this.duration = duration; // min
    this._idCreate();
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }

  _updateWorkout(distance, duration) {
    this.distance = distance; // km
    this.duration = duration; // min
  }
  _idCreate() {
    this.id = String(Math.trunc(Math.random() * 100000000 + 1));
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
  update(distance, duration, cadence) {
    this._updateWorkout(distance, duration);
    this.cadence = cadence;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elvGain) {
    super(coords, distance, duration);
    this.elvGain = elvGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
  update(distance, duration, elvGain) {
    this._updateWorkout(distance, duration);
    this.elvGain = elvGain;
  }
}

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  deleteWorkout;
  editWorkout;
  isAscending = false;

  constructor() {
    // Get user Position
    this._getPosition();

    // Get Data from local storage
    this._getLocalStorage();

    // Delete all Btn
    this._hideClearAll();
    this._showClearAll();

    // Event Handlers
    this._HandleListers();
  }

  _HandleListers() {
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);

    // prettier-ignore
    containerWorkouts.addEventListener('click', this._HandleClickOnWorkout.bind(this));

    deleteAllBtn.addEventListener('click', this._deleteAll.bind(this));
    alertWindowClose.addEventListener('click', () =>
      alertWindow.classList.add('alert-hide')
    );
    sortBtn.addEventListener('click', this._sortWorkouts.bind(this));
    filterDiv.addEventListener('click', this._filterHandler.bind(this));
  }

  _HandleClickOnWorkout(e) {
    this._moveToPopup(e);
    // Selecting Workout html Element and delete btn, Edit btn
    const workoutEle = e.target?.closest('.workout');
    const deleteBtn = e.target
      ?.closest('.workout')
      ?.querySelector('.btn-delete');
    const editBtn = e.target?.closest('.workout')?.querySelector('.btn-edit');

    // Get workout object id
    const workoutId = workoutEle?.dataset?.id;
    const workoutObjIndx = this.#workouts.findIndex(
      work => work.id === workoutId
    );

    const workoutObj = this.#workouts[workoutObjIndx];
    const actionContainer = workoutEle?.querySelector('.workout--actions');

    if (!workoutEle && !editBtn) return;
    if (!workoutEle && !deleteBtn) return;

    if (e.target === deleteBtn) {
      this._deleteWorkout(workoutEle, workoutObjIndx, e);
    }
    if (e.target === editBtn && !actionContainer.querySelector('.btn-save')) {
      //prettier-ignore
      this._editWorkout(workoutEle,editBtn,workoutObjIndx,workoutObj,actionContainer,e);
    }
  }

  _getPosition() {
    // Get Current Position Using Geolocation API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
        alert('Could not get your position.')
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;

    // Leaflet Map Display
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Click Event on the Map
    this.#map.on('click', this._showForm.bind(this));

    // Render Marker
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    // Rendering Form on click
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputCadence.value =
      inputDuration.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  validIn(...inputs) {
    return inputs.every(inp => Number.isFinite(inp));
  }

  isAllPositive(...inputs) {
    return inputs.every(inp => inp > 0);
  }

  _newWorkout(e) {
    e.preventDefault();

    // Get Data
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;
    // Create new Object

    // Running Object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Data Validation
      if (
        !this.validIn(distance, duration, cadence) ||
        !this.isAllPositive(distance, duration, cadence)
      )
        return this.alertMsg();

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // Cycling Object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !this.validIn(distance, duration, elevation) ||
        !this.isAllPositive(distance, duration)
      )
        return this.alertMsg();

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);

    // Rendering Workouts' list
    this._renderWorkout(workout);

    // Add Marker
    this._renderWorkoutMarker(workout);

    // Clear Input fields, Hide Form
    this._hideForm();

    // Show Delete All
    this._showClearAll();

    // Set locale storage
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = ` 
    <li data-type ="${workout.type}" class="workout workout--${
      workout.type
    }" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <input type = "number" min = "0"  readonly class="workout__value" value="${
              workout.distance
            }" />
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <input type = "number" min = "0" readonly class="workout__value" value="${
              workout.duration
            }" />
            <span class="workout__unit">min</span>
          </div>`;
    if (workout.type === 'running') {
      html += `          
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <input type = "number" min = "0" readonly class="workout__value" value="${
              workout.cadence
            }" />
            <span class="workout__unit">spm</span>
          </div>
          <div class = 'workout--actions'>
            <button class="btn btn--action btn-delete">DELETE</button>
            <button class="btn btn--action btn-edit">EDIT</button>
          </div>
    </li>`;
    }

    if (workout.type === 'cycling') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <input type = "number" readonly class="workout__value" value="${
              workout.elvGain
            }" />
            <span class="workout__unit">m</span>
          </div>
          <div class = 'workout--actions'>
            <button class="btn btn--action btn-delete">DELETE</button>
            <button class="btn btn--action btn-edit">EDIT</button>
          </div>
    </li>
      `;
    }
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    let data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    data.forEach(work => {
      if (work.type === 'running')
        this.#workouts.push(
          new Running(work.coords, work.distance, work.duration, work.cadence)
        );
      if (work.type === 'cycling')
        this.#workouts.push(
          new Cycling(work.coords, work.distance, work.duration, work.elvGain)
        );
    });

    data = [];

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _resetLocalStorage() {
    localStorage.removeItem('workouts');
  }

  _updateLocalStorage() {
    this._resetLocalStorage();
    this._setLocalStorage();
  }

  _deleteWorkout(workoutEle, workoutObjIndx, e) {
    // Remove Marker
    this.#map.eachLayer(layer => {
      if (
        layer instanceof L.Marker &&
        layer.getLatLng().equals(this.#workouts[workoutObjIndx].coords)
      ) {
        this.#map.removeLayer(layer);
      }
    });

    // Delete workout from workouts array
    this.#workouts.splice(workoutObjIndx, 1);

    // Delete workout html element
    workoutEle.remove();

    // Update Local Storage
    this._updateLocalStorage();
  }

  _editWorkout(
    workoutEle,
    editBtn,
    workoutObjIndx,
    workoutObj,
    actionContainer,
    e
  ) {
    // Create Save btn
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'SAVE';
    saveBtn.classList.add('btn');
    saveBtn.classList.add('btn-save');
    saveBtn.style.color = 'black';
    actionContainer.appendChild(saveBtn);

    // Get all Input field values
    const allValues = [...workoutEle.querySelectorAll('input.workout__value')];
    allValues.forEach(val => val.removeAttribute('readonly'));

    // prettier-ignore
    saveBtn.addEventListener('click',this._saveEdit.bind(this,workoutObj,workoutObjIndx,allValues,workoutEle,saveBtn));
  }

  _saveEdit(workoutObj, workoutObjIndx, allValues, workoutEle, saveBtn) {
    // Return onlyread values
    allValues.forEach(val => val.setAttribute('readonly', ''));

    // Update the object
    workoutObj.update(
      allValues[0].value,
      allValues[1].value,
      allValues[2].value
    );

    // Update Pace Value or speed
    if (workoutObj.type === 'running') {
      workoutEle.querySelector('span.workout__value').textContent =
        workoutObj.calcPace();
    }
    if (workoutObj.type === 'cycling') {
      workoutEle.querySelector('span.workout__value').textContent =
        workoutObj.calcSpeed();
    }

    // Update the object in the array
    this.#workouts[workoutObjIndx] = workoutObj;

    // this._updateLocalStorage();
    this._updateLocalStorage();

    saveBtn.remove();
  }

  _deleteAll(e) {
    // Delete all workouts array
    this.#workouts = [];

    // Remove All workout elements
    containerWorkouts
      .querySelectorAll('.workout')
      ?.forEach(work => work.remove());

    // Remove all Markers
    this.#map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        this.#map.removeLayer(layer);
      }
    });

    // hide delete All
    this._hideClearAll();

    // Reset Locale Storage
    this._resetLocalStorage();
  }

  _showClearAll() {
    if (containerWorkouts.querySelector('.workout')) {
      deleteAllBtn.classList.remove('hidden');
      sortBtn.classList.remove('hidden');
      filterDiv.classList.remove('hidden');
    }
  }

  _hideClearAll() {
    if (!containerWorkouts.querySelector('.workout')) {
      deleteAllBtn.classList.add('hidden');
      sortBtn.classList.add('hidden');
      filterDiv.classList.add('hidden');
    }
  }

  alertMsg() {
    alertWindow.classList.remove('alert-hide');
    return;
  }

  _sortWorkouts() {
    if (!this.#workouts) return;
    this._clearWorkoutsEle();

    // Sort based on the current order
    if (this.isAscending) {
      this.#workouts.sort((a, b) => a.distance - b.distance);
    } else {
      this.#workouts.sort((a, b) => b.distance - a.distance);
    }

    // Toggle the order for the next click
    this.isAscending = !this.isAscending;

    this.#workouts.forEach(work => this._renderWorkout(work));
    this._updateLocalStorage();
  }

  _clearWorkoutsEle() {
    containerWorkouts
      .querySelectorAll('.workout')
      .forEach(work => work.remove());
  }

  _filterHandler(e) {
    if (!e.target.classList.contains('btn')) return;
    // Get filteration type
    const filterType = e.target.dataset.type;
    const targetBtn = e.target;

    // Remove active from btns
    allFilterBtns.forEach(btn =>
      btn.classList.remove(`active-${btn.dataset.type}`)
    );

    // Add Active to current btn
    console.log(targetBtn, filterType);
    targetBtn.classList.add(`active-${filterType}`);

    // Filter step
    [...document.querySelectorAll('.workout')].forEach(work => {
      if (filterType === 'all') work.classList.remove('hidden');
      else {
        if (work.dataset.type !== filterType) work.classList.add('hidden');
        if (work.dataset.type === filterType) work.classList.remove('hidden');
      }
    });
  }
}

const app = new App();

/*
-- For Edit function :
    // Selecting Workout html Element and delete btn
    // const workoutEle = e.target?.closest('.workout');
    // const editBtn = e.target?.closest('.workout')?.querySelector('.btn-edit');

    // // Get workout object, id
    // const workoutId = workoutEle?.dataset?.id;
    // const workoutObjIndx = this.#workouts.findIndex(
    //   work => work.id === workoutId
    // );
    // const workoutObj = this.#workouts[workoutObjIndx];
    // const actionContainer = workoutEle?.querySelector('.workout--actions');

    // if (!workoutEle && !editBtn) return;

-- For Delete function :
    // Selecting Workout html Element and delete btn
    // const workoutEle = e.target?.closest('.workout');
    // const deleteBtn = e.target
    //   ?.closest('.workout')
    //   ?.querySelector('.btn-delete');

    // // Get workout object id
    // const workoutId = workoutEle?.dataset?.id;
    // const workoutObjIndx = this.#workouts.findIndex(
    //   work => work.id === workoutId
    // );
    // if (!workoutEle && !deleteBtn) return;
*/
