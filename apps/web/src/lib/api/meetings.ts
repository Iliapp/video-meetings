import { request } from './client';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewMeeting {
  title: string;
  date: string;
  participants: string[];
}

export const listMeetings = (token: string) =>
  request<Meeting[]>('GET', '/meetings', { token });

export const createMeeting = (token: string, meeting: NewMeeting) =>
  request<Meeting>('POST', '/meetings', { body: meeting, token });

/** `404` when the meeting doesn't exist or the user isn't its owner or invited. */
export const getMeeting = (token: string, id: string) =>
  request<Meeting>('GET', `/meetings/${encodeURIComponent(id)}`, { token });
