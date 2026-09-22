import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { goBack } from '../src/utils/navigation';

interface Association {
  name: string;
  service: 'navy' | 'army' | 'raf' | 'all';
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  description?: string;
}

const associations: Association[] = [
  // ROYAL NAVY
  {
    name: 'Royal Naval Association (RNA)',
    service: 'navy',
    phone: '023 9272 3747',
    email: 'admin@royalnavalassoc.com',
    website: 'https://www.royal-naval-association.co.uk',
    address: 'Building 1/87, Scott Road, HM Naval Base, Portsmouth, PO1 3LU',
    description: 'Supports RN veterans, serving personnel & families. 400+ branches nationwide.',
  },
  {
    name: 'Royal Marines Association',
    service: 'navy',
    phone: '023 9283 7100',
    address: 'Central Office, Eastney Esplanade, Southsea, Hants PO4 9PX',
    website: 'https://www.rma-trmc.org',
    description: 'Supporting Royal Marines veterans and their families.',
  },
  {
    name: 'Submariners Association',
    service: 'navy',
    website: 'https://www.submarinersassociation.co.uk',
    description: 'For all who have served in HM Submarines.',
  },
  {
    name: 'Fleet Air Arm Association',
    service: 'navy',
    website: 'https://fleetairarmoa.org',
    description: 'For those who served in the Fleet Air Arm.',
  },

  // RAF
  {
    name: 'Royal Air Forces Association (RAFA)',
    service: 'raf',
    phone: '0800 018 2361',
    email: 'enquiries@rafa.org.uk',
    website: 'https://www.rafa.org.uk',
    description: 'Supporting serving & former RAF personnel and their families.',
  },
  {
    name: 'RAF Regiment Association',
    service: 'raf',
    website: 'https://www.raf-regiment.org',
    description: 'For current and former members of the RAF Regiment.',
  },
  {
    name: 'Bomber Command Association',
    service: 'raf',
    website: 'https://www.bombercommandmuseum.com',
    description: 'Preserving the memory of Bomber Command.',
  },

  // ARMY - Household Cavalry & Guards
  {
    name: 'Household Cavalry Association',
    service: 'army',
    phone: '020 7414 2392',
    address: 'Horse Guards, Whitehall, London SW1A 2AX',
    description: 'For Life Guards and Blues and Royals veterans.',
  },
  {
    name: 'Coldstream Guards Association',
    service: 'army',
    website: 'https://www.rhqcoldmgds.co.uk',
    description: 'Supporting Coldstream Guards veterans.',
  },
  {
    name: 'Irish Guards Association',
    service: 'army',
    website: 'https://www.iga-london.co.uk',
    description: 'Supporting Irish Guards veterans and families.',
  },
  {
    name: 'Grenadier Guards Association',
    service: 'army',
    website: 'https://www.grengds.com',
    description: 'For Grenadier Guards past and present.',
  },
  {
    name: 'Scots Guards Association',
    service: 'army',
    website: 'https://www.scotsguards.co.uk',
    description: 'Supporting Scots Guards veterans.',
  },
  {
    name: 'Welsh Guards Association',
    service: 'army',
    website: 'https://www.welshguardsassociation.com',
    description: 'Supporting Welsh Guards veterans.',
  },

  // ARMY - Cavalry
  {
    name: "Queen's Dragoon Guards Association",
    service: 'army',
    website: 'https://www.qdg.org.uk',
    description: 'For QDG veterans and serving soldiers.',
  },
  {
    name: 'Royal Scots Dragoon Guards Association',
    service: 'army',
    website: 'https://www.scotsdg.org.uk',
    description: 'Supporting SCOTS DG veterans.',
  },
  {
    name: "King's Royal Hussars Association",
    service: 'army',
    website: 'https://www.krh.org.uk',
    description: 'For KRH veterans and families.',
  },
  {
    name: 'Royal Tank Regiment Association',
    service: 'army',
    phone: '01onal929 403331',
    website: 'https://www.royaltankregiment.com',
    address: 'RHQ RTR, Bovington Camp, Wareham, Dorset, BH20 6JA',
    description: 'Supporting RTR veterans and families.',
  },

  // ARMY - Infantry Regiments
  {
    name: 'Royal Anglian Regiment Association',
    service: 'army',
    phone: '01603 628455',
    website: 'https://www.royalanglianassociation.co.uk',
    address: 'Britannia Barracks, Norwich, Norfolk, NR1 4HJ',
    description: 'For Royal Anglian Regiment veterans including former county regiments.',
  },
  {
    name: "Queen's Regimental Association",
    service: 'army',
    phone: '07872 901 611',
    address: "RHQ PWRR, HM Fortress Tower of London, London EC3N 4AB",
    description: "For veterans of The Queen's Regiment and antecedent regiments.",
  },
  {
    name: 'Black Watch Association',
    service: 'army',
    website: 'https://www.theblackwatch.co.uk',
    description: 'Supporting Black Watch veterans.',
  },
  {
    name: 'KOSB Association',
    service: 'army',
    website: 'https://www.kosb.co.uk',
    description: "King's Own Scottish Borderers Association.",
  },
  {
    name: 'Royal Irish Regiment Association',
    service: 'army',
    phone: '028 9023 2086',
    address: '5 Waring Street, Belfast, BT1 2EW',
    description: 'For Royal Irish Regiment and predecessor regiment veterans.',
  },
  {
    name: "Duke of Lancaster's Regiment Association",
    service: 'army',
    website: 'https://www.army.mod.uk/infantry/regiments/dukes-of-lancasters-regiment/',
    description: 'Supporting LANCS Regiment veterans.',
  },
  {
    name: 'Parachute Regimental Association',
    service: 'army',
    website: 'https://www.pra.org.uk',
    description: 'Supporting Airborne Forces veterans.',
  },

  // ARMY - Corps
  {
    name: 'Royal Engineers Association',
    service: 'army',
    website: 'https://www.reahq.org.uk',
    description: 'For Royal Engineers past and present.',
  },
  {
    name: 'Royal Signals Association',
    service: 'army',
    website: 'https://www.royalsignals.org/rsa',
    description: 'Supporting Royal Signals veterans.',
  },
  {
    name: 'REME Association',
    service: 'army',
    website: 'https://www.reme-association.org.uk',
    description: 'Royal Electrical and Mechanical Engineers Association.',
  },
  {
    name: 'Royal Logistic Corps Association',
    service: 'army',
    website: 'https://www.rlcassociation.org',
    description: 'For RLC and predecessor corps veterans.',
  },
  {
    name: 'Royal Military Police Association',
    service: 'army',
    website: 'https://www.rhqrmp.org',
    description: 'Supporting RMP veterans.',
  },
  {
    name: 'Army Medical Services Association',
    service: 'army',
    website: 'https://www.ams-association.co.uk',
    description: 'For RAMC, QARANC, RADC, RAVC veterans.',
  },
  {
    name: 'Intelligence Corps Association',
    service: 'army',
    website: 'https://www.intelligencecorps.co.uk',
    description: 'For Int Corps veterans.',
  },
  {
    name: 'Army Air Corps Association',
    service: 'army',
    website: 'https://www.armyaircorpassociation.co.uk',
    description: 'Supporting AAC veterans.',
  },

  // ALL SERVICES
  {
    name: 'Veterans UK',
    service: 'all',
    phone: '0808 1914 218',
    email: 'veterans-uk@mod.gov.uk',
    address: 'Ministry of Defence, Norcross, Thornton Cleveleys, FY5 3WP',
    website: 'https://www.gov.uk/government/organisations/veterans-uk',
    description: 'Official MOD support for benefits, pensions & welfare. All services.',
  },
  {
    name: 'Cobseo (Confederation of Service Charities)',
    service: 'all',
    website: 'https://www.cobseo.org.uk',
    description: 'Directory of 100+ veteran associations and charities.',
  },
  {
    name: 'Armed Forces Pension Enquiries',
    service: 'all',
    phone: '0800 085 3600',
    address: 'JPAC, Kentigern House, 65 Brown Street, Glasgow G2 8EX',
    description: 'For all Armed Forces pension queries.',
  },
];

export default function RegimentalAssociationsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<'all' | 'navy' | 'army' | 'raf'>('all');

  const filteredAssociations = associations.filter((assoc) => {
    const matchesSearch = assoc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (assoc.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesService = selectedService === 'all' || assoc.service === selectedService || assoc.service === 'all';
    return matchesSearch && matchesService;
  });

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'navy': return '#1e3a5f';
      case 'army': return '#4a5d23';
      case 'raf': return '#5b7c99';
      default: return '#374151';
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'navy': return 'anchor';
      case 'army': return 'shield-alt';
      case 'raf': return 'plane';
      default: return 'users';
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleWebsite = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Regimental Associations</Text>
          <Text style={styles.headerSubtitle}>Find your service family</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <FontAwesome5 name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search associations..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Service Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Services', icon: 'users' },
            { key: 'navy', label: 'Royal Navy', icon: 'anchor' },
            { key: 'army', label: 'British Army', icon: 'shield-alt' },
            { key: 'raf', label: 'Royal Air Force', icon: 'plane' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                selectedService === filter.key && styles.filterButtonActive,
                selectedService === filter.key && { backgroundColor: getServiceColor(filter.key) }
              ]}
              onPress={() => setSelectedService(filter.key as any)}
            >
              <FontAwesome5 
                name={filter.icon} 
                size={14} 
                color={selectedService === filter.key ? '#fff' : '#64748b'} 
              />
              <Text style={[
                styles.filterButtonText,
                selectedService === filter.key && styles.filterButtonTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsCount}>
        <Text style={styles.resultsCountText}>
          {filteredAssociations.length} association{filteredAssociations.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Associations List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {filteredAssociations.map((assoc, index) => (
          <View key={index} style={styles.associationCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.serviceTag, { backgroundColor: getServiceColor(assoc.service) }]}>
                <FontAwesome5 name={getServiceIcon(assoc.service)} size={12} color="#fff" />
                <Text style={styles.serviceTagText}>
                  {assoc.service === 'all' ? 'All Services' : 
                   assoc.service === 'navy' ? 'Royal Navy' :
                   assoc.service === 'army' ? 'Army' : 'RAF'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.associationName}>{assoc.name}</Text>
            
            {assoc.description && (
              <Text style={styles.associationDescription}>{assoc.description}</Text>
            )}

            {assoc.address && (
              <View style={styles.addressContainer}>
                <FontAwesome5 name="map-marker-alt" size={12} color="#64748b" />
                <Text style={styles.addressText}>{assoc.address}</Text>
              </View>
            )}

            <View style={styles.contactButtons}>
              {assoc.phone && (
                <TouchableOpacity 
                  style={[styles.contactButton, styles.phoneButton]}
                  onPress={() => handleCall(assoc.phone!)}
                  data-testid={`call-${assoc.name.replace(/\s/g, '-').toLowerCase()}`}
                >
                  <FontAwesome5 name="phone-alt" size={14} color="#16a34a" />
                  <Text style={styles.phoneButtonText}>Call</Text>
                </TouchableOpacity>
              )}

              {assoc.email && (
                <TouchableOpacity 
                  style={[styles.contactButton, styles.emailButton]}
                  onPress={() => handleEmail(assoc.email!)}
                  data-testid={`email-${assoc.name.replace(/\s/g, '-').toLowerCase()}`}
                >
                  <FontAwesome5 name="envelope" size={14} color="#2563eb" />
                  <Text style={styles.emailButtonText}>Email</Text>
                </TouchableOpacity>
              )}

              {assoc.website && (
                <TouchableOpacity 
                  style={[styles.contactButton, styles.websiteButton]}
                  onPress={() => handleWebsite(assoc.website!)}
                  data-testid={`website-${assoc.name.replace(/\s/g, '-').toLowerCase()}`}
                >
                  <FontAwesome5 name="globe" size={14} color="#7c3aed" />
                  <Text style={styles.websiteButtonText}>Website</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Help Finding More */}
        <View style={styles.helpCard}>
          <FontAwesome5 name="question-circle" size={24} color="#3b82f6" />
          <Text style={styles.helpTitle}>Can't find your association?</Text>
          <Text style={styles.helpText}>
            Cobseo maintains a comprehensive directory of 100+ regimental associations. 
            Visit their website or contact Veterans UK for help finding your service family.
          </Text>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => handleWebsite('https://www.cobseo.org.uk/members/regimental-associations/')}
          >
            <Text style={styles.helpButtonText}>Browse Cobseo Directory</Text>
            <FontAwesome5 name="external-link-alt" size={12} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2634',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#1a2634',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  resultsCount: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  resultsCountText: {
    fontSize: 13,
    color: '#64748b',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  associationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 6,
  },
  serviceTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  associationName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  associationDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 10,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  contactButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  phoneButton: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  phoneButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  emailButton: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  emailButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  websiteButton: {
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  websiteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7c3aed',
  },
  helpCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  helpButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
});
