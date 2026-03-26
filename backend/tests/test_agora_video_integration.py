"""
Test Agora Video SDK Integration - Replacing Jitsi with Agora

Tests:
1. Backend /api/events/upcoming returns events list
2. Backend /api/events/{id}/join returns agora_channel, agora_app_id fields
3. Channel name pattern consistency (radiocheck_event{id})
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://block-cms-hotfix.preview.emergentagent.com').rstrip('/')

class TestEventsUpcoming:
    """Test /api/events/upcoming endpoint"""
    
    def test_upcoming_events_returns_list(self):
        """Verify /api/events/upcoming returns a list of events"""
        response = requests.get(f"{BASE_URL}/api/events/upcoming")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} upcoming events")
    
    def test_upcoming_events_have_required_fields(self):
        """Verify events have required fields including jitsi_room_name"""
        response = requests.get(f"{BASE_URL}/api/events/upcoming")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            event = data[0]
            required_fields = ['id', 'title', 'event_date', 'duration_minutes', 
                             'host_name', 'status', 'jitsi_room_name', 'participant_count']
            for field in required_fields:
                assert field in event, f"Missing required field: {field}"
            print(f"Event '{event['title']}' has all required fields")
        else:
            pytest.skip("No upcoming events to test")


class TestEventsJoin:
    """Test /api/events/{id}/join endpoint - Agora integration"""
    
    @pytest.fixture
    def event_id(self):
        """Get an event ID to test with"""
        response = requests.get(f"{BASE_URL}/api/events/upcoming")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]['id']
        pytest.skip("No events available for testing")
    
    def test_join_event_returns_agora_fields(self, event_id):
        """Verify join endpoint returns agora_channel and agora_app_id"""
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check for Agora fields
        assert 'agora_channel' in data, "Missing agora_channel field"
        assert 'agora_app_id' in data, "Missing agora_app_id field"
        
        print(f"agora_channel: {data['agora_channel']}")
        print(f"agora_app_id: {data['agora_app_id']}")
    
    def test_join_event_agora_app_id_correct(self, event_id):
        """Verify agora_app_id matches expected value"""
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        assert response.status_code == 200
        
        data = response.json()
        expected_app_id = "cfd84eb3fcd7490cbe366d8cd1a4d974"
        assert data['agora_app_id'] == expected_app_id, \
            f"Expected app_id {expected_app_id}, got {data['agora_app_id']}"
        print(f"Agora App ID verified: {data['agora_app_id']}")
    
    def test_join_event_agora_channel_pattern(self, event_id):
        """Verify agora_channel follows radiocheck_event{id} pattern"""
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        assert response.status_code == 200
        
        data = response.json()
        channel = data['agora_channel']
        
        # Channel should start with radiocheck_event
        assert channel.startswith('radiocheck_event'), \
            f"Channel should start with 'radiocheck_event', got: {channel}"
        
        # Channel should contain the event ID (without dashes)
        event_id_clean = event_id.replace('-', '').lower()
        assert event_id_clean in channel, \
            f"Channel should contain event ID {event_id_clean}, got: {channel}"
        
        print(f"Channel pattern verified: {channel}")
    
    def test_join_event_still_returns_jitsi_room_name(self, event_id):
        """Verify jitsi_room_name is still returned for backwards compatibility"""
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert 'jitsi_room_name' in data, "Missing jitsi_room_name field (backwards compatibility)"
        print(f"jitsi_room_name (backwards compat): {data['jitsi_room_name']}")
    
    def test_join_event_returns_all_required_fields(self, event_id):
        """Verify join endpoint returns all required fields"""
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        assert response.status_code == 200
        
        data = response.json()
        required_fields = [
            'event_id', 'jitsi_room_name', 'agora_channel', 'agora_app_id',
            'display_name', 'is_moderator', 'config'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify display_name is echoed back
        assert data['display_name'] == 'TestUser', \
            f"Expected display_name 'TestUser', got {data['display_name']}"
        
        print("All required fields present in join response")


class TestChannelNameConsistency:
    """Test channel name pattern consistency between portal and mobile app"""
    
    def test_channel_name_derivation_pattern(self):
        """
        Verify the channel name derivation pattern:
        - Portal AgoraRoom: radiocheck_${roomName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}
        - Mobile AgoraMeetComponent: radiocheck_${roomName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}
        - Backend: radiocheck_event{event_id.replace('-', '').lower()}
        
        All should produce the same channel name for event_123
        """
        # Simulate the pattern for event_123
        room_name = "event_123"
        
        # Frontend pattern (both portal and mobile)
        import re
        frontend_channel = f"radiocheck_{re.sub(r'[^a-zA-Z0-9]', '', room_name).lower()}"
        
        # Backend pattern (from events.py line 403)
        event_id = "123"
        backend_channel = f"radiocheck_event{event_id.replace('-', '').lower()}"
        
        print(f"Frontend channel: {frontend_channel}")
        print(f"Backend channel: {backend_channel}")
        
        # Both should produce radiocheck_event123
        assert frontend_channel == "radiocheck_event123", \
            f"Frontend channel mismatch: {frontend_channel}"
        assert backend_channel == "radiocheck_event123", \
            f"Backend channel mismatch: {backend_channel}"
        
        print("Channel name patterns are consistent!")
    
    def test_real_event_channel_consistency(self):
        """Test with a real event from the API"""
        response = requests.get(f"{BASE_URL}/api/events/upcoming")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No events available")
        
        event = response.json()[0]
        event_id = event['id']
        
        # Get join details
        join_response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        assert join_response.status_code == 200
        
        join_data = join_response.json()
        backend_channel = join_data['agora_channel']
        
        # Simulate frontend channel derivation
        room_name = f"event_{event_id}"
        import re
        frontend_channel = f"radiocheck_{re.sub(r'[^a-zA-Z0-9]', '', room_name).lower()}"
        
        print(f"Event ID: {event_id}")
        print(f"Backend channel: {backend_channel}")
        print(f"Frontend channel (simulated): {frontend_channel}")
        
        # They should match
        assert backend_channel == frontend_channel, \
            f"Channel mismatch! Backend: {backend_channel}, Frontend: {frontend_channel}"
        
        print("Real event channel names match!")


class TestEventTypes:
    """Test event types for virtual/hybrid events"""
    
    def test_events_have_event_type_field(self):
        """Verify events include event_type field"""
        response = requests.get(f"{BASE_URL}/api/events/upcoming")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            event = data[0]
            # event_type may not be present in all events (defaults to 'in-person')
            event_type = event.get('event_type', 'in-person')
            assert event_type in ['in-person', 'virtual', 'hybrid'], \
                f"Invalid event_type: {event_type}"
            print(f"Event type: {event_type}")
        else:
            pytest.skip("No events to test")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
