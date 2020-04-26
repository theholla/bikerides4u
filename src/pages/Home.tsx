import React, { Component } from 'react';
import axios from 'axios';
import { getDistance } from 'geolib';
import { EventListHeader, EventListContent, Controls, Map, Modal, Error } from '../components';
import { Coordinate } from '../../types';
import { getISODate, BikeRide, FormattedEvent } from '../helpers/format-events';
import { formatEvents } from '../helpers/format-events';
import './Home.css';

const defaultCoords = {
  latitude: 45.522723,
  longitude: -122.656115,
};

interface HomeState {
  data: {
    start: string;
    end: string;
    events: BikeRide[];
  };
  isModalOpen: boolean;
  filteredEvents: BikeRide[];
  selectedEventId?: string;
  mapCenter: Coordinate;
  loading: boolean;
  error: string | null;
}
export class Home extends Component<{}, HomeState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      loading: true,
      data: {
        events: [],
        start: getISODate(new Date()),
        end: getISODate(new Date(), 3.888e9), // 45 days in milliseconds
      },
      isModalOpen: false,
      filteredEvents: [],
      mapCenter: defaultCoords,
      error: null,
    };
  }

  componentDidMount(): void {
    this.fetchEvents();
  }

  openModal = (): void => this.setState({ isModalOpen: true });
  closeModal = (): void => this.setState({ isModalOpen: false });
  handleEventListItemClick = (selectedEventId: string): void => this.setState({ selectedEventId });
  handleEventsFiltered = (filteredEvents: BikeRide[]): void => this.setState({ filteredEvents });

  updateMapCenter = (userLocation?: Coordinate): void => {
    const { data, filteredEvents } = this.state;
    const mapCenter = userLocation || defaultCoords;
    this.setState({
      mapCenter,
      data: {
        ...data,
        events: data.events.map((event) => this.addDistanceTo(event, mapCenter)),
      },
      filteredEvents: filteredEvents.map((event) => this.addDistanceTo(event, mapCenter)),
    });
  };

  addDistanceTo(ride: FormattedEvent, mapCenter: Coordinate): BikeRide {
    const METERS_TO_MILES = 0.00062137;
    const distance = getDistance(mapCenter, ride.latLng, 0.1);
    return {
      ...ride,
      distanceTo: Number((distance * METERS_TO_MILES).toFixed(1)),
    };
  }

  fetchEvents(): Promise<void> {
    const { data, mapCenter } = this.state;
    this.setState({ loading: true });
    return axios
      .get(`/api/shift-events?start=${data.start}&end=${data.end}`)
      .then((response) => {
        const events = formatEvents(response.data).map((event) => this.addDistanceTo(event, mapCenter));
        this.setState({
          data: { ...data, events },
          filteredEvents: events,
          loading: false,
        });
      })
      .catch((err) => {
        let errMsg = 'Error retrieving events for date';

        // FIXME: handle additional error states
        if (!err.response) {
          errMsg = 'No response from BR4U API';
        }

        console.error(errMsg, { start: data.start, end: data.end, err });

        this.setState({
          loading: false,
          error: errMsg,
        });
      });
  }

  render(): JSX.Element {
    const { data, loading, filteredEvents, mapCenter, selectedEventId, isModalOpen, error } = this.state;
    return (
      <div id="site-content">
        <div id="sidebar">
          <div id="map-disclaimer">
            <Error error="Wider screen required to display map. Distance is from Thai Champa if location is not enabled." />
          </div>
          <div>
            <EventListHeader events={filteredEvents} handleFiltersButtonClick={this.openModal} />
            <div className="event-list">
              <EventListContent
                error={error}
                loading={loading}
                events={filteredEvents}
                handleListItemClick={this.handleEventListItemClick}
              />
            </div>
          </div>
        </div>
        <div id="map">
          <Map mapCenter={mapCenter} points={filteredEvents} selectedEventId={selectedEventId} />
        </div>
        <Modal id="event-list-modal" title={'Filters'} isOpen={isModalOpen} handleCloseButtonClick={this.closeModal}>
          <Controls
            data={data}
            handleEventsFiltered={this.handleEventsFiltered}
            updateMapCenter={this.updateMapCenter}
          />
        </Modal>
      </div>
    );
  }
}
