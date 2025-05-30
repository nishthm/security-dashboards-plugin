/*
 *   Copyright OpenSearch Contributors
 *
 *   Licensed under the Apache License, Version 2.0 (the "License").
 *   You may not use this file except in compliance with the License.
 *   A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   or in the "license" file accompanying this file. This file is distributed
 *   on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *   express or implied. See the License for the specific language governing
 *   permissions and limitations under the License.
 */

import React, { useState, useContext } from 'react';
import {
  EuiSmallButton,
  EuiPageContentHeader,
  EuiPageContentHeaderSection,
  EuiSpacer,
  EuiTabbedContent,
  EuiTitle,
  EuiPageContent,
  EuiText,
  EuiLink,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPageBody,
  EuiInMemoryTable,
  EuiEmptyPrompt,
  EuiCallOut,
  EuiGlobalToastList,
  EuiHorizontalRule,
  EuiSmallButtonEmpty,
} from '@elastic/eui';
import { difference } from 'lodash';
import { BreadcrumbsPageDependencies } from '../../../types';
import { buildHashUrl, buildUrl } from '../../utils/url-builder';
import {
  Action,
  SubAction,
  RoleMappingDetail,
  DataObject,
  ActionGroupItem,
  RoleIndexPermissionView,
  RoleTenantPermissionView,
} from '../../types';
import { ResourceType } from '../../../../../common';
import {
  getRoleMappingData,
  MappedUsersListing,
  updateRoleMapping,
  transformRoleMappingData,
  UserType,
} from '../../utils/role-mapping-utils';
import { createUnknownErrorToast, useToastState } from '../../utils/toast-utils';
import { fetchActionGroups } from '../../utils/action-groups-utils';
import { getRoleDetail } from '../../utils/role-detail-utils';
import { ClusterPermissionPanel } from '../role-view/cluster-permission-panel';
import { IndexPermissionPanel } from './index-permission-panel';
import { TenantsPanel } from './tenants-panel';
import { transformRoleIndexPermissions } from '../../utils/index-permission-utils';
import { transformRoleTenantPermissions } from '../../utils/tenant-utils';
import { DocLinks } from '../../constants';
import { useDeleteConfirmState } from '../../utils/delete-confirm-modal-utils';
import { ExternalLink, ExternalLinkButton } from '../../utils/display-utils';
import { showTableStatusMessage } from '../../utils/loading-spinner-utils';
import { useContextMenuState } from '../../utils/context-menu';
import { requestDeleteRoles } from '../../utils/role-list-utils';
import { setCrossPageToast } from '../../utils/storage-utils';
import { DataSourceContext } from '../../app-router';
import { SecurityPluginTopNavMenu } from '../../top-nav-menu';
import { getClusterInfo } from '../../../../utils/datasource-utils';
import { PageHeader } from '../../header/header-components';
import { getDashboardsInfoSafe } from '../../../../utils/dashboards-info-utils';

interface RoleViewProps extends BreadcrumbsPageDependencies {
  roleName: string;
  prevAction: string;
}

const mappedUserColumns = [
  {
    field: 'userType',
    name: 'User type',
    sortable: true,
  },
  {
    field: 'userName',
    name: 'User',
    sortable: true,
    truncateText: true,
  },
];

export function RoleView(props: RoleViewProps) {
  const duplicateRoleLink = buildHashUrl(ResourceType.roles, Action.duplicate, props.roleName);

  const [mappedUsers, setMappedUsers] = React.useState<MappedUsersListing[]>([]);
  const [errorFlag, setErrorFlag] = React.useState(false);
  const [selection, setSelection] = useState<MappedUsersListing[]>([]);
  const [hosts, setHosts] = React.useState<string[]>([]);
  const [actionGroupDict, setActionGroupDict] = React.useState<DataObject<ActionGroupItem>>({});
  const [roleClusterPermission, setRoleClusterPermission] = useState<string[]>([]);
  const [roleIndexPermission, setRoleIndexPermission] = React.useState<RoleIndexPermissionView[]>(
    []
  );
  const [roleTenantPermission, setRoleTenantPermission] = React.useState<
    RoleTenantPermissionView[]
  >([]);
  const [toasts, addToast, removeToast] = useToastState();
  const [isReserved, setIsReserved] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const dataSourceEnabled = !!props.depsStart.dataSource?.dataSourceEnabled;
  const { dataSource, setDataSource } = useContext(DataSourceContext)!;
  const [isMultiTenancyEnabled, setIsMultiTenancyEnabled] = useState(true);

  const PERMISSIONS_TAB_INDEX = 0;
  const MAP_USER_TAB_INDEX = 1;

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const originalRoleMapData = await getRoleMappingData(
          props.coreStart.http,
          props.roleName,
          dataSource.id
        );
        if (originalRoleMapData) {
          setMappedUsers(transformRoleMappingData(originalRoleMapData));
          setHosts(originalRoleMapData.hosts);
        }

        const actionGroups = await fetchActionGroups(props.coreStart.http, dataSource.id);
        setActionGroupDict(actionGroups);
        const roleData = await getRoleDetail(props.coreStart.http, props.roleName, dataSource.id);
        setIsReserved(roleData.reserved);
        setRoleClusterPermission(roleData.cluster_permissions);
        setRoleIndexPermission(transformRoleIndexPermissions(roleData.index_permissions));
        setRoleTenantPermission(transformRoleTenantPermissions(roleData.tenant_permissions));
      } catch (e) {
        addToast(createUnknownErrorToast('fetchRoleMappingData', 'load data'));
        console.log(e);
        setErrorFlag(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [addToast, props.coreStart.http, props.roleName, props.prevAction, dataSource]);

  React.useEffect(() => {
    const fetchIsMultiTenancyEnabled = async () => {
      try {
        const dashboardsInfo = await getDashboardsInfoSafe(props.coreStart.http);
        setIsMultiTenancyEnabled(
          Boolean(dashboardsInfo?.multitenancy_enabled && props.config.multitenancy.enabled)
        );
      } catch (e) {
        console.error(e);
      }
    };

    fetchIsMultiTenancyEnabled();
  }, [props.coreStart.http, props.config.multitenancy]);

  const handleRoleMappingDelete = async () => {
    try {
      const usersToDelete: string[] = selection.map((r) => r.userName);
      const internalUsers: string[] = mappedUsers
        .filter((r) => r.userType === UserType.internal)
        .map((r) => r.userName);
      const externalIdentities: string[] = mappedUsers
        .filter((r) => r.userType === UserType.external)
        .map((r) => r.userName);
      const updateObject: RoleMappingDetail = {
        users: difference(internalUsers, usersToDelete),
        backend_roles: difference(externalIdentities, usersToDelete),
        hosts,
      };
      await updateRoleMapping(props.coreStart.http, props.roleName, updateObject, dataSource.id);

      setMappedUsers(difference(mappedUsers, selection));
      setSelection([]);
    } catch (e) {
      console.log(e);
    }
  };

  const [showDeleteConfirmModal, deleteConfirmModal] = useDeleteConfirmState(
    handleRoleMappingDelete,
    'mapping(s)'
  );

  const emptyListMessage = (
    <EuiEmptyPrompt
      title={<h2>No user has been mapped to this role</h2>}
      titleSize="s"
      body={
        <EuiText size="s" color="subdued" grow={false}>
          <p>You can map users or backend roles to this role</p>
        </EuiText>
      }
      actions={
        <EuiFlexGroup gutterSize="s" alignItems="center">
          <EuiFlexItem>
            <ExternalLinkButton
              text="Create internal user"
              href={buildHashUrl(ResourceType.users, Action.create)}
            />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiSmallButton
              data-test-subj="map-users"
              fill
              onClick={() => {
                window.location.href = buildHashUrl(
                  ResourceType.roles,
                  Action.edit,
                  props.roleName,
                  SubAction.mapuser
                );
              }}
            >
              Map users
            </EuiSmallButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      }
    />
  );

  const tabs = [
    {
      id: 'permissions',
      name: 'Permissions',
      disabled: false,
      content: (
        <>
          <EuiSpacer size="m" />

          {isReserved && (
            <EuiCallOut
              title="This role is reserved for the Security plugin environment. Reserved roles are restricted for any permission customizations."
              iconType="lock"
              size="s"
            >
              <p>
                Make use of this role by mapping users. You can also{' '}
                <EuiLink href={buildHashUrl(ResourceType.roles, Action.create)}>
                  create your own role
                </EuiLink>{' '}
                or <EuiLink href={duplicateRoleLink}>duplicate</EuiLink> this one for further
                customization.
              </p>
            </EuiCallOut>
          )}

          <EuiSpacer size="m" />

          <ClusterPermissionPanel
            roleName={props.roleName}
            clusterPermissions={roleClusterPermission}
            actionGroups={actionGroupDict}
            loading={loading}
            isReserved={isReserved}
          />

          <EuiSpacer size="m" />

          <IndexPermissionPanel
            roleName={props.roleName}
            indexPermissions={roleIndexPermission}
            actionGroups={actionGroupDict}
            errorFlag={errorFlag}
            loading={loading}
            isReserved={isReserved}
          />

          <EuiSpacer size="m" />

          {isMultiTenancyEnabled && (
            <TenantsPanel
              roleName={props.roleName}
              tenantPermissions={roleTenantPermission}
              errorFlag={errorFlag}
              coreStart={props.coreStart}
              loading={loading}
              isReserved={isReserved}
              dataSourceId={dataSource.id}
            />
          )}
        </>
      ),
    },
    {
      id: 'users',
      name: 'Mapped users',
      disabled: false,
      content: (
        <>
          <EuiSpacer />
          <EuiPageContent>
            <EuiPageContentHeader>
              <EuiPageContentHeaderSection>
                <EuiTitle size="s">
                  <h3>
                    Mapped users
                    <span className="panel-header-count"> ({mappedUsers.length})</span>
                  </h3>
                </EuiTitle>
                <EuiText size="xs" color="subdued" className="panel-header-subtext">
                  You can map two types of users: users and backend roles. A user can have its own
                  backend role and host for an external authentication and authorization. A backend
                  role directly maps to roles through an external authentication system.{' '}
                  <ExternalLink href={DocLinks.MapUsersToRolesDoc} />
                </EuiText>
              </EuiPageContentHeaderSection>
              <EuiPageContentHeaderSection>
                <EuiFlexGroup>
                  <EuiFlexItem>
                    <EuiSmallButton
                      onClick={showDeleteConfirmModal}
                      disabled={selection.length === 0}
                    >
                      Delete mapping
                    </EuiSmallButton>
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiSmallButton
                      data-test-subj="manage-mapping"
                      onClick={() => {
                        window.location.href = buildHashUrl(
                          ResourceType.roles,
                          Action.edit,
                          props.roleName,
                          SubAction.mapuser
                        );
                      }}
                    >
                      Manage mapping
                    </EuiSmallButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPageContentHeaderSection>
            </EuiPageContentHeader>
            <EuiHorizontalRule margin="s" />
            <EuiPageBody>
              <EuiInMemoryTable
                data-test-subj="role-mapping-list"
                tableLayout={'auto'}
                loading={mappedUsers === [] && !errorFlag}
                columns={mappedUserColumns}
                items={mappedUsers}
                itemId={'userName'}
                pagination={true}
                message={showTableStatusMessage(loading, mappedUsers, emptyListMessage)}
                selection={{ onSelectionChange: setSelection }}
                sorting={true}
                error={
                  errorFlag ? 'Load data failed, please check console log for more detail.' : ''
                }
              />
            </EuiPageBody>
          </EuiPageContent>
        </>
      ),
    },
  ];

  let pageActions;
  const actionsMenuItems: React.ReactElement[] = [
    <EuiSmallButtonEmpty key="duplicate" href={duplicateRoleLink}>
      duplicate
    </EuiSmallButtonEmpty>,
    <EuiSmallButtonEmpty
      data-test-subj="delete"
      key="delete"
      color="danger"
      onClick={async () => {
        try {
          await requestDeleteRoles(props.coreStart.http, [props.roleName], dataSource.id);
          setCrossPageToast(buildUrl(ResourceType.roles), {
            id: 'deleteRole',
            color: 'success',
            title: `${props.roleName} deleted ${getClusterInfo(dataSourceEnabled, dataSource)}`,
          });
          window.location.href = buildHashUrl(ResourceType.roles);
        } catch (e) {
          addToast(createUnknownErrorToast('deleteRole', 'delete role'));
        }
      }}
    >
      delete
    </EuiSmallButtonEmpty>,
  ];
  const [actionsMenu] = useContextMenuState('Actions', {}, actionsMenuItems);
  const useUpdatedUX = props.coreStart.uiSettings.get('home:useNewHomePage');

  if (isReserved) {
    pageActions = <EuiSmallButton href={duplicateRoleLink}>Duplicate role</EuiSmallButton>;
  } else {
    pageActions = (
      <EuiFlexGroup gutterSize="s">
        <EuiFlexItem>{actionsMenu}</EuiFlexItem>
        <EuiFlexItem>
          <EuiSmallButton href={buildHashUrl(ResourceType.roles, Action.edit, props.roleName)}>
            Edit role
          </EuiSmallButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  const reservedRoleButtons = [
    {
      label: 'Duplicate role',
      isLoading: false,
      href: buildHashUrl(ResourceType.roles, Action.edit, props.roleName),
      type: 'button',
      fill: true,
    },
  ];
  const roleButtons = [
    {
      isLoading: false,
      run: async () => {
        try {
          await requestDeleteRoles(props.coreStart.http, [props.roleName], dataSource.id);
          setCrossPageToast(buildUrl(ResourceType.roles), {
            id: 'deleteRole',
            color: 'success',
            title: `${props.roleName} deleted ${getClusterInfo(dataSourceEnabled, dataSource)}`,
          });
          window.location.href = buildHashUrl(ResourceType.roles);
        } catch (e) {
          addToast(createUnknownErrorToast('deleteRole', 'delete role'));
        }
      },
      iconType: 'trash',
      color: 'danger',
      type: 'button', // this should be icon, but icons current do not support a border currently
      testId: 'delete',
      ariaLabel: 'delete',
    },
    {
      label: 'Duplicate',
      isLoading: false,
      href: duplicateRoleLink,
      type: 'button',
    },
    {
      label: 'Edit role',
      isLoading: false,
      href: buildHashUrl(ResourceType.roles, Action.edit, props.roleName),
      fill: true,
      type: 'button',
    },
  ];

  const roleView = isReserved ? reservedRoleButtons : roleButtons;

  return (
    <>
      <SecurityPluginTopNavMenu
        {...props}
        dataSourcePickerReadOnly={true}
        setDataSource={setDataSource}
        selectedDataSource={dataSource}
      />
      <PageHeader
        navigation={props.depsStart.navigation}
        coreStart={props.coreStart}
        appRightControls={roleView}
        fallBackComponent={
          <>
            <EuiPageContentHeader>
              <EuiPageContentHeaderSection>
                <EuiText size="s">
                  <h1>{props.roleName}</h1>
                </EuiText>
              </EuiPageContentHeaderSection>

              <EuiPageContentHeaderSection>{pageActions}</EuiPageContentHeaderSection>
            </EuiPageContentHeader>
          </>
        }
        resourceType={ResourceType.roles}
        subAction={props.roleName}
      />
      <EuiTabbedContent
        tabs={tabs}
        initialSelectedTab={
          props.prevAction === SubAction.mapuser
            ? tabs[MAP_USER_TAB_INDEX]
            : tabs[PERMISSIONS_TAB_INDEX]
        }
        size="s"
      />

      <EuiSpacer />
      <EuiGlobalToastList toasts={toasts} toastLifeTimeMs={10000} dismissToast={removeToast} />
      {deleteConfirmModal}
    </>
  );
}
