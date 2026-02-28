import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet,
  TextInput,
  Linking,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

// Veteran-specific NHS services
const VETERAN_NHS_SERVICES = [
  {
    name: 'Op COURAGE',
    desc: 'NHS specialist mental health service for armed forces veterans',
    phone: '0300 323 0137',
    url: 'https://www.nhs.uk/nhs-services/armed-forces-community/mental-health/veterans-reservists/',
    coverage: 'England',
    services: ['PTSD treatment', 'Depression & anxiety', 'Substance misuse', 'Complex trauma']
  },
  {
    name: 'Veterans NHS Wales',
    desc: 'Specialist mental health support for Welsh veterans',
    phone: '0800 132 737',
    url: 'https://veteranswales.health.wales/',
    coverage: 'Wales',
    services: ['Mental health assessment', 'Treatment pathways', 'Peer support']
  },
  {
    name: 'Combat Stress Scotland',
    desc: 'Veterans mental health charity with Scottish NHS partnership',
    phone: '0800 138 1619',
    url: 'https://combatstress.org.uk/',
    coverage: 'Scotland',
    services: ['24-hour helpline', 'Community outreach', 'Residential treatment']
  },
  {
    name: 'Veterans Support NI',
    desc: 'Mental health support for Northern Ireland veterans',
    phone: '0800 138 1619',
    url: 'https://www.nidirect.gov.uk/articles/mental-health-services-veterans',
    coverage: 'Northern Ireland',
    services: ['Mental health services', 'PTSD support', 'Wellbeing programmes']
  }
];

// Regional NHS Trusts with veteran services (sample - would be expanded)
const REGIONAL_SERVICES: { [key: string]: { name: string; phone: string; url: string }[] } = {
  'London': [
    { name: 'Veterans Mental Health TIL (London)', phone: '020 3317 6818', url: 'https://www.slam.nhs.uk/veterans' },
    { name: 'NHS London Veteran Service', phone: '0300 323 0137', url: 'https://www.nhs.uk/nhs-services/armed-forces-community/mental-health/veterans-reservists/' }
  ],
  'North West': [
    { name: 'Veterans Mental Health TIL (North West)', phone: '0161 271 0642', url: 'https://www.penninecare.nhs.uk/veterans' },
    { name: 'Walking With The Wounded (Manchester)', phone: '01011 462156', url: 'https://walkingwiththewounded.org.uk/' }
  ],
  'Midlands': [
    { name: 'Veterans Mental Health TIL (Midlands)', phone: '0300 790 0264', url: 'https://www.covwarkpt.nhs.uk/veterans' },
    { name: 'Combat Stress (Birmingham Hub)', phone: '0800 138 1619', url: 'https://combatstress.org.uk/' }
  ],
  'Yorkshire': [
    { name: 'Veterans Mental Health TIL (Yorkshire)', phone: '0113 855 6609', url: 'https://www.leedsandyorkpft.nhs.uk/veterans' },
    { name: 'Project Nova (Yorkshire)', phone: '0800 917 7299', url: 'https://www.rfea.org.uk/project-nova/' }
  ],
  'South West': [
    { name: 'Veterans Mental Health TIL (South West)', phone: '0117 378 4232', url: 'https://www.awp.nhs.uk/veterans' },
    { name: 'Help for Heroes (Recovery Centre Tedworth)', phone: '0808 802 1212', url: 'https://www.helpforheroes.org.uk/' }
  ],
  'South East': [
    { name: 'Veterans Mental Health TIL (South East)', phone: '01622 724 100', url: 'https://www.kmpt.nhs.uk/veterans' },
    { name: 'Combat Stress (Leatherhead)', phone: '0800 138 1619', url: 'https://combatstress.org.uk/' }
  ],
  'East of England': [
    { name: 'Veterans Mental Health TIL (East)', phone: '0300 555 1201', url: 'https://www.nsft.nhs.uk/veterans' },
    { name: 'Royal British Legion (Regional)', phone: '0808 802 8080', url: 'https://www.britishlegion.org.uk/' }
  ],
  'North East': [
    { name: 'Veterans Mental Health TIL (North East)', phone: '0191 566 5454', url: 'https://www.tewv.nhs.uk/veterans' },
    { name: 'East Durham Veterans Trust', phone: '0191 581 5677', url: 'https://www.eastdurhamveterans.co.uk/' },
    { name: 'Walking With The Wounded (Newcastle)', phone: '01011 462156', url: 'https://walkingwiththewounded.org.uk/' }
  ]
};

// Postcode to region mapping (simplified - first letter/digits)
const getRegionFromPostcode = (postcode: string): string | null => {
  const normalized = postcode.toUpperCase().replace(/\s/g, '');
  const prefix = normalized.substring(0, 2);
  
  // London postcodes
  if (['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'EC', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 
       'NW', 'SE', 'SW', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'WC'].some(p => prefix.startsWith(p))) {
    return 'London';
  }
  // North West
  if (['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'WA', 'WN', 'BL', 'OL', 'SK', 'CW', 'L1', 'L2', 'L3', 'PR', 'BB', 'FY', 'LA', 'CA'].some(p => prefix.startsWith(p))) {
    return 'North West';
  }
  // Midlands
  if (['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'CV', 'DY', 'WS', 'WV', 'ST', 'DE', 'NG', 'LE', 'NN'].some(p => prefix.startsWith(p))) {
    return 'Midlands';
  }
  // Yorkshire
  if (['LS', 'BD', 'HX', 'HD', 'WF', 'HU', 'DN', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'YO', 'HG'].some(p => prefix.startsWith(p))) {
    return 'Yorkshire';
  }
  // South West
  if (['BS', 'BA', 'GL', 'SN', 'SP', 'BH', 'DT', 'EX', 'PL', 'TQ', 'TR', 'TA'].some(p => prefix.startsWith(p))) {
    return 'South West';
  }
  // South East
  if (['RG', 'SL', 'HP', 'MK', 'OX', 'GU', 'KT', 'SM', 'CR', 'BR', 'DA', 'ME', 'CT', 'TN', 'BN', 'RH', 'PO', 'SO'].some(p => prefix.startsWith(p))) {
    return 'South East';
  }
  // East of England
  if (['CB', 'PE', 'IP', 'NR', 'CO', 'CM', 'SS', 'RM', 'IG', 'EN', 'SG', 'AL', 'LU', 'MK'].some(p => prefix.startsWith(p))) {
    return 'East of England';
  }
  // North East
  if (['NE', 'SR', 'DH', 'DL', 'TS'].some(p => prefix.startsWith(p))) {
    return 'North East';
  }
  // Wales
  if (['CF', 'SA', 'LL', 'SY', 'LD', 'NP'].some(p => prefix.startsWith(p))) {
    return 'Wales';
  }
  // Scotland
  if (['EH', 'G1', 'G2', 'G3', 'G4', 'G5', 'PA', 'KA', 'ML', 'FK', 'KY', 'DD', 'AB', 'PH', 'IV', 'KW', 'HS', 'ZE'].some(p => prefix.startsWith(p))) {
    return 'Scotland';
  }
  // Northern Ireland
  if (['BT'].some(p => prefix.startsWith(p))) {
    return 'Northern Ireland';
  }
  
  return null;
};

export default function LocalServicesPage() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [postcode, setPostcode] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameSearchResults, setNameSearchResults] = useState<{ name: string; phone: string; url: string; region: string }[]>([]);
  
  const styles = createStyles(colors, theme);

  // Search by organization name or town across all regions
  const searchByName = (query: string): { name: string; phone: string; url: string; region: string }[] => {
    const results: { name: string; phone: string; url: string; region: string }[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Search through all regional services
    Object.entries(REGIONAL_SERVICES).forEach(([region, services]) => {
      services.forEach(service => {
        if (service.name.toLowerCase().includes(lowerQuery)) {
          results.push({ ...service, region });
        }
      });
    });
    
    // Also search national services
    VETERAN_NHS_SERVICES.forEach(service => {
      if (service.name.toLowerCase().includes(lowerQuery) || 
          service.desc.toLowerCase().includes(lowerQuery)) {
        results.push({ name: service.name, phone: service.phone, url: service.url, region: service.coverage });
      }
    });
    
    return results;
  };

  // Town/area to region mapping
  const getRegionFromTown = (town: string): string | null => {
    const lowerTown = town.toLowerCase();
    
    // North East towns
    if (['durham', 'seaham', 'sunderland', 'newcastle', 'gateshead', 'hartlepool', 'middlesbrough', 'stockton', 'darlington', 'bishop auckland', 'peterlee', 'washington', 'south shields', 'north shields', 'whitley bay', 'tynemouth', 'consett', 'chester-le-street', 'houghton', 'easington'].some(t => lowerTown.includes(t))) {
      return 'North East';
    }
    // North West towns
    if (['manchester', 'liverpool', 'preston', 'blackpool', 'bolton', 'wigan', 'warrington', 'chester', 'carlisle', 'lancaster', 'blackburn', 'burnley', 'rochdale', 'oldham', 'stockport', 'salford'].some(t => lowerTown.includes(t))) {
      return 'North West';
    }
    // Yorkshire towns
    if (['leeds', 'sheffield', 'bradford', 'york', 'hull', 'doncaster', 'wakefield', 'huddersfield', 'halifax', 'barnsley', 'rotherham', 'scarborough', 'harrogate'].some(t => lowerTown.includes(t))) {
      return 'Yorkshire';
    }
    // Midlands towns
    if (['birmingham', 'nottingham', 'leicester', 'coventry', 'derby', 'stoke', 'wolverhampton', 'dudley', 'walsall', 'telford', 'lincoln', 'northampton'].some(t => lowerTown.includes(t))) {
      return 'Midlands';
    }
    // London
    if (['london', 'westminster', 'camden', 'islington', 'hackney', 'tower hamlets', 'greenwich', 'lewisham', 'southwark', 'lambeth', 'wandsworth', 'hammersmith', 'kensington', 'chelsea', 'brent', 'ealing', 'hounslow', 'richmond', 'kingston', 'croydon', 'bromley', 'bexley', 'havering', 'barking', 'redbridge', 'newham', 'walthamstow', 'enfield', 'barnet', 'haringey'].some(t => lowerTown.includes(t))) {
      return 'London';
    }
    // South East towns
    if (['brighton', 'southampton', 'portsmouth', 'reading', 'oxford', 'milton keynes', 'slough', 'guildford', 'maidstone', 'canterbury', 'dover', 'hastings', 'eastbourne', 'crawley', 'woking', 'basingstoke', 'winchester'].some(t => lowerTown.includes(t))) {
      return 'South East';
    }
    // South West towns
    if (['bristol', 'bath', 'exeter', 'plymouth', 'bournemouth', 'poole', 'swindon', 'gloucester', 'cheltenham', 'taunton', 'torquay', 'truro', 'penzance'].some(t => lowerTown.includes(t))) {
      return 'South West';
    }
    // East of England towns
    if (['cambridge', 'norwich', 'ipswich', 'peterborough', 'colchester', 'chelmsford', 'southend', 'luton', 'watford', 'stevenage', 'st albans', 'bedford'].some(t => lowerTown.includes(t))) {
      return 'East of England';
    }
    // Wales
    if (['cardiff', 'swansea', 'newport', 'wrexham', 'barry', 'neath', 'cwmbran', 'pontypool', 'llanelli', 'bridgend', 'caerphilly', 'merthyr', 'rhondda', 'aberdare', 'pontypridd'].some(t => lowerTown.includes(t))) {
      return 'Wales';
    }
    // Scotland
    if (['edinburgh', 'glasgow', 'aberdeen', 'dundee', 'inverness', 'perth', 'stirling', 'falkirk', 'ayr', 'kilmarnock', 'paisley', 'east kilbride', 'hamilton', 'motherwell', 'livingston', 'dunfermline', 'kirkcaldy'].some(t => lowerTown.includes(t))) {
      return 'Scotland';
    }
    // Northern Ireland
    if (['belfast', 'derry', 'londonderry', 'lisburn', 'newry', 'bangor', 'newtownabbey', 'craigavon', 'ballymena', 'newtownards', 'carrickfergus', 'coleraine', 'omagh', 'armagh', 'enniskillen'].some(t => lowerTown.includes(t))) {
      return 'Northern Ireland';
    }
    
    return null;
  };

  const handleSearch = () => {
    if (!postcode.trim()) {
      setError('Please enter a postcode, town, or service name');
      return;
    }
    
    setIsSearching(true);
    setError(null);
    setNameSearchResults([]);
    
    setTimeout(() => {
      const query = postcode.trim();
      
      // First try postcode lookup
      let region = getRegionFromPostcode(query);
      
      // If not a postcode, try town name
      if (!region) {
        region = getRegionFromTown(query);
      }
      
      // Also search by organization name
      const nameResults = searchByName(query);
      
      if (region) {
        setSearchResult(region);
        setNameSearchResults([]);
      } else if (nameResults.length > 0) {
        setSearchResult(null);
        setNameSearchResults(nameResults);
      } else {
        setError('Could not find services. Try a postcode, town name, or organisation name.');
      }
      setIsSearching(false);
    }, 500);
  };

  const getCountryService = () => {
    if (!searchResult) return null;
    
    if (searchResult === 'Wales') {
      return VETERAN_NHS_SERVICES.find(s => s.coverage === 'Wales');
    }
    if (searchResult === 'Scotland') {
      return VETERAN_NHS_SERVICES.find(s => s.coverage === 'Scotland');
    }
    if (searchResult === 'Northern Ireland') {
      return VETERAN_NHS_SERVICES.find(s => s.coverage === 'Northern Ireland');
    }
    return VETERAN_NHS_SERVICES.find(s => s.coverage === 'England');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Local Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View style={styles.introCard}>
          <Ionicons name="location" size={40} color="#10b981" />
          <Text style={styles.introTitle}>Veteran Mental Health Services</Text>
          <Text style={styles.introText}>
            Find NHS and charity mental health services specifically for veterans in your area.
          </Text>
        </View>

        {/* Postcode Search */}
        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>Search by postcode, town, or organisation</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.postcodeInput}
              placeholder="e.g. SR7, Durham, East Durham"
              placeholderTextColor="#94a3b8"
              value={postcode}
              onChangeText={setPostcode}
              autoCapitalize="characters"
              maxLength={30}
            />
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#fff" />
                  <Text style={styles.searchButtonText}>Find</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>

        {/* Search Results */}
        {searchResult && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>
              Services in {searchResult}
            </Text>

            {/* Country-specific NHS Service */}
            {getCountryService() && (
              <TouchableOpacity 
                style={styles.primaryServiceCard}
                onPress={() => Linking.openURL(getCountryService()!.url)}
              >
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>NHS VETERAN SERVICE</Text>
                </View>
                <Text style={styles.primaryName}>{getCountryService()!.name}</Text>
                <Text style={styles.primaryDesc}>{getCountryService()!.desc}</Text>
                <View style={styles.servicesList}>
                  {getCountryService()!.services.map((service, i) => (
                    <View key={i} style={styles.serviceTag}>
                      <Text style={styles.serviceTagText}>{service}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  style={styles.phoneButton}
                  onPress={() => Linking.openURL(`tel:${getCountryService()!.phone.replace(/\s/g, '')}`)}
                >
                  <Ionicons name="call" size={18} color="#fff" />
                  <Text style={styles.phoneButtonText}>{getCountryService()!.phone}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}

            {/* Regional Services */}
            {REGIONAL_SERVICES[searchResult] && (
              <>
                <Text style={styles.subSectionTitle}>Local Services</Text>
                {REGIONAL_SERVICES[searchResult].map((service, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={styles.serviceCard}
                    onPress={() => Linking.openURL(service.url)}
                  >
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <TouchableOpacity 
                        style={styles.servicePhone}
                        onPress={(e) => {
                          e.stopPropagation();
                          Linking.openURL(`tel:${service.phone.replace(/\s/g, '')}`);
                        }}
                      >
                        <Ionicons name="call" size={14} color="#10b981" />
                        <Text style={styles.servicePhoneText}>{service.phone}</Text>
                      </TouchableOpacity>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        {/* National Services (always shown) */}
        <View style={styles.nationalSection}>
          <Text style={styles.sectionTitle}>National Veteran Services</Text>
          <Text style={styles.sectionSubtitle}>Available to all UK veterans</Text>

          {VETERAN_NHS_SERVICES.map((service, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.nationalCard}
              onPress={() => Linking.openURL(service.url)}
            >
              <View style={styles.nationalHeader}>
                <Text style={styles.nationalName}>{service.name}</Text>
                <View style={styles.coverageBadge}>
                  <Text style={styles.coverageBadgeText}>{service.coverage}</Text>
                </View>
              </View>
              <Text style={styles.nationalDesc}>{service.desc}</Text>
              <TouchableOpacity 
                style={styles.nationalPhone}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(`tel:${service.phone.replace(/\s/g, '')}`);
                }}
              >
                <Ionicons name="call" size={16} color="#10b981" />
                <Text style={styles.nationalPhoneText}>{service.phone}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* First Point of Contact */}
        <View style={styles.gatewayCard}>
          <Ionicons name="flag" size={32} color="#3b82f6" />
          <Text style={styles.gatewayTitle}>Not sure where to start?</Text>
          <Text style={styles.gatewayText}>
            Veterans&apos; Gateway is your first point of contact. They can connect you with the right services.
          </Text>
          <TouchableOpacity 
            style={styles.gatewayButton}
            onPress={() => Linking.openURL('tel:08088021212')}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.gatewayButtonText}>0808 802 1212</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Note */}
        <View style={styles.emergencyCard}>
          <Ionicons name="warning" size={20} color="#dc2626" />
          <Text style={styles.emergencyText}>
            In a mental health crisis? Call Samaritans 116 123 (24/7) or go to your nearest A&E.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, theme: string) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Intro Card
  introCard: {
    backgroundColor: theme === 'dark' ? '#064e3b' : '#ecfdf5',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  introText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Search Card
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  postcodeInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    textTransform: 'uppercase',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 8,
  },

  // Results Section
  resultsSection: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },

  // Primary Service Card
  primaryServiceCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  primaryBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  primaryName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  primaryDesc: {
    fontSize: 14,
    color: '#b0c4de',
    marginBottom: 12,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  serviceTag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  serviceTagText: {
    fontSize: 12,
    color: '#b0c4de',
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  phoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Sub Section
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
  },

  // Service Cards
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  servicePhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  servicePhoneText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },

  // National Section
  nationalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },

  // National Card
  nationalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nationalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nationalName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  coverageBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  coverageBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  nationalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  nationalPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nationalPhoneText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },

  // Gateway Card
  gatewayCard: {
    backgroundColor: theme === 'dark' ? '#1e3a5f' : '#eff6ff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  gatewayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  gatewayText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 20,
  },
  gatewayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
  },
  gatewayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Emergency Card
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  emergencyText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
});
