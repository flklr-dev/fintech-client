import { useNavigation as useNavigationOriginal, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
 
export const useNavigation = () => {
  const navigation = useNavigationOriginal<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, keyof RootStackParamList>>();
  
  return {
    ...navigation,
    route
  };
}; 